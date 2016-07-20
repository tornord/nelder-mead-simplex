var nm = new NelderMeadSimplex();
var cs1 = [new SimplexConstant(0.0, 1.2), new SimplexConstant(0.0, 0.8)];
var fun1 = function (x) {
    return x[0] * x[0] - 4 * x[0] + x[1] * x[1] - x[1] - x[0] * x[1]; // x^2-4x+y^2-y-xy
}
var res1 = nm.regress(cs1, 1e-7, 200, fun1); // x = 3.0, y = 2.0, "Converged", 55, error = -7.0

var cs2 = [new SimplexConstant(1.5, 0.5), new SimplexConstant(0.0, 0.5)];
var fun2 = function(x) {
    return Math.abs(Math.sin(x[0])-Math.pow(x[1],3)+1)+x[0]*x[0]+Math.pow(x[1],4)/10; // abs(sin(x)-y^3+1)+x^2+y^4/10
}
var res2 = nm.regress(cs2, 1e-12, 200, fun2); // x = -0.065051, y = 0.9778440, "Converged", 160, error = -0.0956595
