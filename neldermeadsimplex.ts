class SimplexConstant {
    constructor(public value: number, public initialPerturbation: number) {   
    }
}

class RegressionResult {
    constructor(public terminationReason: string, public constants: number[], 
        public errorValue: number, public evaluationCount: number) {   
    }
}

class ErrorProfile {
    constructor(public highestIndex: number, public nextHighestIndex: number, 
        public lowestIndex: number) {   
    }
}

class Vector {
    constructor(public dimensions: number) {
        this.values = [];
        this.values.length = dimensions;
        for (var i=0; i<this.values.length; i++) {
            this.values[i] = 0;
        }
    }

    get dimensions(): number {
        return this.values.length;
    }

    dimensions: number[];

    clone() {
        var res = new Vector(this.dimensions);
        for (var i=0; i<this.values.length; i++) {
            res.values[i] = this.values[i];
        }
        return res;     
    }

    add(v: Vector) {
        if (this.dimensions != v.dimensions)
            throw new RangeError();
        for (var i=0; i<this.values.length; i++) {
            this.values[i] += v.values[i];
        }
        return this;
    }

    subtract(v: Vector) {
        if (this.dimensions != v.dimensions)
            throw new RangeError();
        for (var i=0; i<this.values.length; i++) {
            this.values[i] -= v.values[i];
        }
        return this;
    }

    multiply(k: number) {
        for (var i=0; i<this.values.length; i++) {
            this.values[i] *= k;
        }
        return this;
    }
}

class NelderMeadSimplex {
    constructor() {
        this.jitter = 1e-10;
    }

    jitter: number;

    regress(simplexConstants: SimplexConstant[], convergenceTolerance: number, 
        maxEvaluations: number, objectiveFunction: (x: number[]) => number[]) {
        
        var numDimensions = simplexConstants.length;
        var numVertices = numDimensions + 1;
        var vertices = this.initializeVertices(simplexConstants);

        var evaluationCount = 0;
        var terminationReason = "Unspecified";
        var errorProfile;

        var errorValues = this.initializeErrorValues(vertices, objectiveFunction);

        while (true) {
            var errorProfile = this.evaluateSimplex(errorValues);
            if (this.hasConverged(convergenceTolerance, errorProfile, errorValues)) {
                terminationReason = "Converged";
                break;
            }
            var reflectionPointValue = this.tryToScaleSimplex(-1.0, errorProfile, vertices, errorValues, objectiveFunction);
            evaluationCount++;
            if (reflectionPointValue <= errorValues[errorProfile.lowestIndex]) {
                var expansionPointValue = this.tryToScaleSimplex(2.0, errorProfile, vertices, errorValues, objectiveFunction);
                evaluationCount++;
            }
            else if (reflectionPointValue >= errorValues[errorProfile.nextHighestIndex]) {
                var currentWorst = errorValues[errorProfile.highestIndex];
                contractionPointValue = this.tryToScaleSimplex(0.5, errorProfile, vertices, errorValues, objectiveFunction);
                evaluationCount++;
                if (contractionPointValue >= currentWorst) {
                    this.shrinkSimplex(errorProfile, vertices, errorValues, objectiveFunction);
                    evaluationCount += numVertices;
                }
            }
            if (evaluationCount >= maxEvaluations) {
                terminationReason = "MaxFunctionEvaluations";
                break;
            }
        }
        return new RegressionResult(terminationReason, vertices[errorProfile.lowestIndex].values, 
            errorValues[errorProfile.lowestIndex], evaluationCount);
    }

    initializeVertices(simplexConstants: SimplexConstant[]) {
        var numDimensions = simplexConstants.length;
        var vertices = [];
        var p0 = new Vector(numDimensions);
        for (var i=0; i<numDimensions; i++) {
            p0.values[i] = simplexConstants[i].value;
        }
        vertices.push(p0);
        for (var i=0; i<numDimensions; i++) {
            var scale = simplexConstants[i].initialPerturbation;
            var unitVector = new Vector(numDimensions);
            unitVector.values[i] = 1;
            vertices.push(p0.clone().add(unitVector.multiply(scale)));
        }
        return vertices;
    }

    initializeErrorValues(vertices: Vector[], objectiveFunction: (x: number[]) => number[]) {
        var errorValues = [];
        for (var i=0; i<vertices.length; i++) {
            errorValues.push(objectiveFunction(vertices[i].values));
        }
        return errorValues;
    }

    evaluateSimplex(errorValues: number[]) {
        var errorProfile = new ErrorProfile();
        if (errorValues[0] > errorValues[1]) {
            errorProfile.highestIndex = 0;
            errorProfile.nextHighestIndex = 1;
        }
        else {
            errorProfile.highestIndex = 1;
            errorProfile.nextHighestIndex = 0;
        }
        errorProfile.lowestIndex = 0;
        for (var i=0; i<errorValues.length; i++) {
            var errorValue = errorValues[i];
            if (errorValue <= errorValues[errorProfile.lowestIndex]) {
                errorProfile.lowestIndex = i;
            }
            if (errorValue > errorValues[errorProfile.highestIndex]) {
                errorProfile.nextHighestIndex = errorProfile.highestIndex;
                errorProfile.highestIndex = i;
            }
            else if (errorValue > errorValues[errorProfile.nextHighestIndex] && i != errorProfile.highestIndex) {
                errorProfile.nextHighestIndex = i;
            }
        }
        return errorProfile;
    }

    hasConverged(convergenceTolerance: number, errorProfile: ErrorProfile, errorValues: number[]) {
        var range = 2 * Math.abs(errorValues[errorProfile.highestIndex] - errorValues[errorProfile.lowestIndex]) /
                (Math.abs(errorValues[errorProfile.highestIndex]) + Math.abs(errorValues[errorProfile.lowestIndex]) + this.jitter);

        if (range < convergenceTolerance)
            return true;
        return false;
    }

    tryToScaleSimplex(scaleFactor: number, errorProfile: ErrorProfile, vertices: Vector[], errorValues: number[], objectiveFunction: (x: number[]) => number[]) {
        var centroid = this.computeCentroid(vertices, errorProfile);
        var centroidToHighPoint = vertices[errorProfile.highestIndex].clone().subtract(centroid);
        var newPoint = centroidToHighPoint.multiply(scaleFactor).add(centroid);
        var newErrorValue = objectiveFunction(newPoint.values);
        if (newErrorValue < errorValues[errorProfile.highestIndex]) {
            vertices[errorProfile.highestIndex] = newPoint;
            errorValues[errorProfile.highestIndex] = newErrorValue;
        }
        return newErrorValue;
    }

    computeCentroid(vertices: Vector[], errorProfile: ErrorProfile) {
        var numVertices = vertices.length;
        var centroid = new Vector(numVertices - 1);
        for (var i=0; i<numVertices; i++) {
            if (i != errorProfile.highestIndex) {
                centroid.add(vertices[i]);
            }
        }
        return centroid.multiply(1.0 / (numVertices - 1));
    }
}