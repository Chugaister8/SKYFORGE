import math
from app.simulation.physics.base import UAVPhysicsConfig, PhysicsState, ControlInput, UAVType
from app.simulation.physics.pid import PIDController
from app.simulation.physics.atmosphere import GRAVITY, air_density, WindModel

class FixedWingPhysics:
    def __init__(self, config: UAVPhysicsConfig, wind: WindModel | None = None) -> None:
        self.cfg=config; self.wind=wind or WindModel()
        self.pid_alt  = PIDController(**config.pid_altitude, output_min=-math.radians(15), output_max=math.radians(15))
        self.pid_speed= PIDController(**config.pid_velocity, output_min=0.0, output_max=1.0)

    def step(self, state: PhysicsState, cmd: ControlInput, dt: float) -> PhysicsState:
        cmd=self._autopilot(state,cmd,dt)
        tau=self.cfg.motor_time_const
        act=state.actual_throttle+dt/tau*(cmd.throttle_cmd-state.actual_throttle)
        act=max(0.0,min(1.0,act))
        wx,wy,wz=self.wind.get_wind(dt)
        rvx=state.vx-wx; rvy=state.vy-wy; rvz=state.vz-wz
        asp=max(math.sqrt(rvx**2+rvy**2+rvz**2),0.1)
        alpha=math.atan2(-state.vz, max(math.sqrt(state.vx**2+state.vy**2),0.1))
        cl=max(-1.5,min(2.0, self.cfg.lift_coefficient+self.cfg.cl_alpha*alpha))
        ar=self.cfg.wingspan_m**2/self.cfg.wing_area_m2
        cd=self.cfg.cd0+cl**2/(math.pi*ar*self.cfg.oswald_e)
        rho=air_density(state.altitude_m); q=0.5*rho*asp**2; S=self.cfg.wing_area_m2
        lift=cl*q*S; drag=cd*q*S; thrust=act*self.cfg.max_thrust_n
        fuel_burn=act*(self.cfg.fuel_capacity_kg*0.0002)*dt if self.cfg.fuel_capacity_kg>0 else 0.0
        fuel_rem=max(0.0, state.fuel_remaining-fuel_burn/max(self.cfg.fuel_capacity_kg,0.001))
        cp=math.cos(state.pitch); sp=math.sin(state.pitch); cy=math.cos(state.yaw); sy=math.sin(state.yaw)
        cr=math.cos(state.roll)
        tx=thrust*cp*cy/self.cfg.mass_kg; ty=thrust*cp*sy/self.cfg.mass_kg; tz=-thrust*sp/self.cfg.mass_kg
        lz=-lift*cr*cp/self.cfg.mass_kg
        dx=-drag*rvx/asp/self.cfg.mass_kg; dy=-drag*rvy/asp/self.cfg.mass_kg; dz=-drag*rvz/asp/self.cfg.mass_kg
        ax=tx+dx; ay=ty+dy; az=GRAVITY+tz+lz+dz
        ra=(cmd.roll_cmd*2.0-state.p*0.5)/self.cfg.ixx
        pa=(cmd.pitch_cmd*1.5-state.q*0.5)/self.cfg.iyy
        ya=(cmd.yaw_cmd*1.0-state.r*0.5)/self.cfg.izz
        if asp<self.cfg.stall_speed_ms and self.cfg.stall_speed_ms>0:
            ax-=state.vx*0.5; ay-=state.vy*0.5; az+=2.0
        ns=PhysicsState(
            x=state.x+state.vx*dt, y=state.y+state.vy*dt, z=state.z+state.vz*dt,
            vx=state.vx+ax*dt, vy=state.vy+ay*dt, vz=state.vz+az*dt,
            roll=state.roll+state.p*dt, pitch=state.pitch+state.q*dt, yaw=state.yaw+state.r*dt,
            p=state.p+ra*dt, q=state.q+pa*dt, r=state.r+ya*dt,
            throttle=cmd.throttle_cmd, actual_throttle=act, fuel_remaining=fuel_rem,
            sim_time_s=state.sim_time_s+dt,
        )
        if ns.z>0: ns.z=0.0; ns.vz=0.0
        spd=math.sqrt(ns.vx**2+ns.vy**2+ns.vz**2)
        if spd>self.cfg.max_speed_ms:
            s=self.cfg.max_speed_ms/spd; ns.vx*=s; ns.vy*=s; ns.vz*=s
        ns.airspeed_ms=math.sqrt(ns.vx**2+ns.vy**2+ns.vz**2)
        ns.groundspeed_ms=math.sqrt(ns.vx**2+ns.vy**2)
        ns.altitude_m=-ns.z
        return ns

    def _autopilot(self, state, cmd, dt):
        if cmd.target_altitude_m is None and cmd.target_speed_ms is None: return cmd
        import dataclasses; new_cmd=dataclasses.replace(cmd)
        if cmd.target_speed_ms is not None:
            new_cmd.throttle_cmd=self.pid_speed.update(cmd.target_speed_ms,state.airspeed_ms,dt)
        if cmd.target_altitude_m is not None:
            pt=self.pid_alt.update(cmd.target_altitude_m,state.altitude_m,dt)
            new_cmd.pitch_cmd=max(-1.0,min(1.0,pt/math.radians(15)))
        if cmd.target_heading_deg is not None:
            err=math.radians(cmd.target_heading_deg)-state.yaw
            while err>math.pi: err-=2*math.pi
            while err<-math.pi: err+=2*math.pi
            new_cmd.roll_cmd=max(-1.0,min(1.0,err*2.0))
        return new_cmd
