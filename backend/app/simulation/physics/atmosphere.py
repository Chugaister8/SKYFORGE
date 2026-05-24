import math
SEA_LEVEL_DENSITY=1.225; SEA_LEVEL_PRESSURE=101325.0; SEA_LEVEL_TEMP=288.15
LAPSE_RATE=0.0065; GAS_CONSTANT=287.05; GRAVITY=9.80665

def air_density(altitude_m: float) -> float:
    if altitude_m < 0: altitude_m = 0.0
    if altitude_m > 11000:
        temp=216.65; pressure=22632.1*math.exp(-GRAVITY*(altitude_m-11000)/(GAS_CONSTANT*temp))
    else:
        temp=SEA_LEVEL_TEMP-LAPSE_RATE*altitude_m
        pressure=SEA_LEVEL_PRESSURE*(temp/SEA_LEVEL_TEMP)**(GRAVITY/(LAPSE_RATE*GAS_CONSTANT))
    return pressure/(GAS_CONSTANT*temp)

def dynamic_pressure(airspeed_ms: float, altitude_m: float) -> float:
    return 0.5*air_density(altitude_m)*airspeed_ms**2

class WindModel:
    def __init__(self, speed_ms: float=0.0, direction_deg: float=0.0, turbulence: float=0.0) -> None:
        self.base_wind=(speed_ms*math.cos(math.radians(direction_deg)),speed_ms*math.sin(math.radians(direction_deg)),0.0)
        self.turbulence=turbulence; self._t=0.0
    def get_wind(self, dt: float) -> tuple[float,float,float]:
        import random; self._t+=dt; s=self.turbulence*2.0
        return (self.base_wind[0]+random.gauss(0,s), self.base_wind[1]+random.gauss(0,s), self.base_wind[2]+random.gauss(0,s*0.3))
