class PIDController:
    def __init__(self, p: float, i: float, d: float, output_min: float=-1.0, output_max: float=1.0, integral_limit: float=10.0) -> None:
        self.kp=p; self.ki=i; self.kd=d; self.output_min=output_min; self.output_max=output_max; self.integral_limit=integral_limit
        self._integral=0.0; self._prev_error=0.0; self._initialized=False

    def update(self, setpoint: float, measured: float, dt: float) -> float:
        if dt <= 0: return 0.0
        error = setpoint - measured
        derivative = (error - self._prev_error) / dt if self._initialized else 0.0
        self._initialized = True
        self._integral = max(-self.integral_limit, min(self.integral_limit, self._integral + error * dt))
        output = self.kp*error + self.ki*self._integral + self.kd*derivative
        self._prev_error = error
        return max(self.output_min, min(self.output_max, output))

    def reset(self) -> None:
        self._integral=0.0; self._prev_error=0.0; self._initialized=False
