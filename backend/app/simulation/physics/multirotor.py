import math
from app.simulation.physics.base import UAVPhysicsConfig, PhysicsState, ControlInput, UAVType
from app.simulation.physics.pid import PIDController
from app.simulation.physics.atmosphere import GRAVITY, WindModel

class MultirotorPhysics:
    def __init__(self, config: UAVPhysicsConfig, wind: WindModel | None = None) -> None:
        self.cfg=config; self.wind=wind or WindModel()
        self.pid_roll    = PIDController(**config.pid_roll,    output_min=-math.radians(config.max_roll_deg), output_max=math.radians(config.max_roll_deg))
        self.pid_pitch   = PIDController(**config.pid_pitch,   output_min=-math.radians(config.max_pitch_deg),output_max=math.radians(config.max_pitch_deg))
        self.pid_yaw_rate= PIDController(**config.pid_yaw,     output_min=-2.0, output_max=2.0)
        self.pid_altitude= PIDController(**config.pid_altitude, output_min=-1.0, output_max=1.0)

    def step(self, state: PhysicsState, cmd: ControlInput, dt: float) -> PhysicsState:
        cmd = self._autopilot(state, cmd, dt)
        tau = self.cfg.motor_time_const
        act = state.actual_throttle + dt/tau*(cmd.throttle_cmd-state.actual_throttle)
        act = max(0.0, min(1.0, act))
        k1=self._deriv(state,cmd,act,dt); s2=self._app(state,k1,dt/2)
        k2=self._deriv(s2,cmd,act,dt);   s3=self._app(state,k2,dt/2)
        k3=self._deriv(s3,cmd,act,dt);   s4=self._app(state,k3,dt)
        k4=self._deriv(s4,cmd,act,dt)
        def w(i): return (k1[i]+2*k2[i]+2*k3[i]+k4[i])/6
        ns=PhysicsState(
            x=state.x+w(0)*dt, y=state.y+w(1)*dt, z=state.z+w(2)*dt,
            vx=state.vx+w(3)*dt, vy=state.vy+w(4)*dt, vz=state.vz+w(5)*dt,
            roll=state.roll+w(6)*dt, pitch=state.pitch+w(7)*dt, yaw=state.yaw+w(8)*dt,
            p=state.p+(cmd.roll_cmd*3.0-state.p)*dt/0.05,
            q=state.q+(cmd.pitch_cmd*3.0-state.q)*dt/0.05,
            r=state.r+(cmd.yaw_cmd*2.0-state.r)*dt/0.08,
            throttle=cmd.throttle_cmd, actual_throttle=act,
            fuel_remaining=max(0.0, state.fuel_remaining-act*0.0001*dt),
            sim_time_s=state.sim_time_s+dt,
        )
        if ns.z > 0: ns.z=0.0; ns.vz=0.0
        ns.roll  = max(-math.radians(self.cfg.max_roll_deg),  min(math.radians(self.cfg.max_roll_deg),  ns.roll))
        ns.pitch = max(-math.radians(self.cfg.max_pitch_deg), min(math.radians(self.cfg.max_pitch_deg), ns.pitch))
        ns.airspeed_ms=math.sqrt(ns.vx**2+ns.vy**2+ns.vz**2)
        ns.groundspeed_ms=math.sqrt(ns.vx**2+ns.vy**2)
        ns.altitude_m=-ns.z
        return ns

    def _deriv(self, s, cmd, act, dt):
        thrust=act*self.cfg.max_thrust_n
        cr,sr=math.cos(s.roll),math.sin(s.roll); cp,sp=math.cos(s.pitch),math.sin(s.pitch)
        tx=thrust*(-sp); ty=thrust*(sr*cp); tz=thrust*(cr*cp)
        wx,wy,wz=self.wind.get_wind(dt)
        rvx=s.vx-wx; rvy=s.vy-wy; rvz=s.vz-wz
        asp=math.sqrt(rvx**2+rvy**2+rvz**2)
        df=0.5*1.225*asp**2*self.cfg.drag_coefficient*self.cfg.wing_area_m2
        if asp>0.01: dx=-df*rvx/asp/self.cfg.mass_kg; dy=-df*rvy/asp/self.cfg.mass_kg; dz=-df*rvz/asp/self.cfg.mass_kg
        else: dx=dy=dz=0.0
        return (s.vx,s.vy,s.vz, tx/self.cfg.mass_kg+dx, ty/self.cfg.mass_kg+dy, -GRAVITY+tz/self.cfg.mass_kg+dz, s.p,s.q,s.r)

    def _app(self, s, k, dt):
        return PhysicsState(x=s.x+k[0]*dt,y=s.y+k[1]*dt,z=s.z+k[2]*dt, vx=s.vx+k[3]*dt,vy=s.vy+k[4]*dt,vz=s.vz+k[5]*dt,
            roll=s.roll+k[6]*dt,pitch=s.pitch+k[7]*dt,yaw=s.yaw+k[8]*dt, p=s.p,q=s.q,r=s.r,
            throttle=s.throttle,actual_throttle=s.actual_throttle,fuel_remaining=s.fuel_remaining,sim_time_s=s.sim_time_s)

    def _autopilot(self, state, cmd, dt):
        if cmd.target_altitude_m is None: return cmd
        import dataclasses; new_cmd=dataclasses.replace(cmd)
        vz=self.pid_altitude.update(cmd.target_altitude_m, state.altitude_m, dt)
        vz=max(-self.cfg.max_climb_ms, min(self.cfg.max_climb_ms, vz))
        hover=self.cfg.mass_kg*GRAVITY/self.cfg.max_thrust_n
        new_cmd.throttle_cmd=max(0.0,min(1.0, hover-vz/self.cfg.max_climb_ms*0.4))
        if cmd.target_heading_deg is not None:
            err=math.radians(cmd.target_heading_deg)-state.yaw
            while err>math.pi: err-=2*math.pi
            while err<-math.pi: err+=2*math.pi
            new_cmd.yaw_cmd=max(-1.0,min(1.0,err*self.cfg.pid_yaw["p"]))
        return new_cmd
