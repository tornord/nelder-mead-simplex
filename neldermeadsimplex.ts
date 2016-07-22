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
        for (let i=0; i<this.values.length; i++) {
            this.values[i] = 0;
        }
    }

    get dimensions(): number {
        return this.values.length;
    }

    dimensions: number[];

    clone() {
        let res = new Vector(this.dimensions);
        for (let i=0; i<this.values.length; i++) {
            res.values[i] = this.values[i];
        }
        return res;     
    }

    add(v: Vector) {
        if (this.dimensions != v.dimensions)
            throw new RangeError();
        for (let i=0; i<this.values.length; i++) {
            this.values[i] += v.values[i];
        }
        return this;
    }

    subtract(v: Vector) {
        if (this.dimensions != v.dimensions)
            throw new RangeError();
        for (let i=0; i<this.values.length; i++) {
            this.values[i] -= v.values[i];
        }
        return this;
    }

    multiply(k: number) {
        for (let i=0; i<this.values.length; i++) {
            this.values[i] *= k;
        }
        return this;
    }
}

class NelderMeadSimplex {
    constructor() {
    }

    static jitter: number = 1e-10;

    static regress(simplexConstants: SimplexConstant[], convergenceTolerance: number, 
        maxEvaluations: number, objectiveFunction: (x: number[]) => number) {
        
        let numDimensions = simplexConstants.length;
        let numVertices = numDimensions + 1;
        let vertices = NelderMeadSimplex.initializeVertices(simplexConstants);

        let evaluationCount = 0;
        let terminationReason = "Unspecified";
        let errorProfile;

        let errorValues = NelderMeadSimplex.initializeErrorValues(vertices, objectiveFunction);
        let errorProfile;

        while (true) {
            errorProfile = NelderMeadSimplex.evaluateSimplex(errorValues);
            if (NelderMeadSimplex.hasConverged(convergenceTolerance, errorProfile, errorValues)) {
                terminationReason = "Converged";
                break;
            }
            let reflectionPointValue = NelderMeadSimplex.tryToScaleSimplex(-1.0, errorProfile, vertices, errorValues, objectiveFunction);
            evaluationCount++;
            if (reflectionPointValue <= errorValues[errorProfile.lowestIndex]) {
                let expansionPointValue = NelderMeadSimplex.tryToScaleSimplex(2.0, errorProfile, vertices, errorValues, objectiveFunction);
                evaluationCount++;
            }
            else if (reflectionPointValue >= errorValues[errorProfile.nextHighestIndex]) {
                let currentWorst = errorValues[errorProfile.highestIndex];
                contractionPointValue = NelderMeadSimplex.tryToScaleSimplex(0.5, errorProfile, vertices, errorValues, objectiveFunction);
                evaluationCount++;
                if (contractionPointValue >= currentWorst) {
                    NelderMeadSimplex.shrinkSimplex(errorProfile, vertices, errorValues, objectiveFunction);
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

    static initializeVertices(simplexConstants: SimplexConstant[]) {
        let numDimensions = simplexConstants.length;
        let vertices = [];
        let p0 = new Vector(numDimensions);
        for (let i=0; i<numDimensions; i++) {
            p0.values[i] = simplexConstants[i].value;
        }
        vertices.push(p0);
        for (let i=0; i<numDimensions; i++) {
            let scale = simplexConstants[i].initialPerturbation;
            let unitVector = new Vector(numDimensions);
            unitVector.values[i] = 1;
            vertices.push(p0.clone().add(unitVector.multiply(scale)));
        }
        return vertices;
    }

    static initializeErrorValues(vertices: Vector[], objectiveFunction: (x: number[]) => number) {
        let errorValues = [];
        for (let i=0; i<vertices.length; i++) {
            errorValues.push(objectiveFunction(vertices[i].values));
        }
        return errorValues;
    }

    static evaluateSimplex(errorValues: number[]) {
        let errorProfile = new ErrorProfile();
        if (errorValues[0] > errorValues[1]) {
            errorProfile.highestIndex = 0;
            errorProfile.nextHighestIndex = 1;
        }
        else {
            errorProfile.highestIndex = 1;
            errorProfile.nextHighestIndex = 0;
        }
        errorProfile.lowestIndex = 0;
        for (let i=0; i<errorValues.length; i++) {
            let errorValue = errorValues[i];
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

    static hasConverged(convergenceTolerance: number, errorProfile: ErrorProfile, errorValues: number[]) {
        let range = 2 * Math.abs(errorValues[errorProfile.highestIndex] - errorValues[errorProfile.lowestIndex]) /
                (Math.abs(errorValues[errorProfile.highestIndex]) + Math.abs(errorValues[errorProfile.lowestIndex]) + NelderMeadSimplex.jitter);

        if (range < convergenceTolerance)
            return true;
        return false;
    }

    static tryToScaleSimplex(scaleFactor: number, errorProfile: ErrorProfile, vertices: Vector[], errorValues: number[], 
        objectiveFunction: (x: number[]) => number) {
        let centroid = NelderMeadSimplex.computeCentroid(vertices, errorProfile);
        let centroidToHighPoint = vertices[errorProfile.highestIndex].clone().subtract(centroid);
        let newPoint = centroidToHighPoint.multiply(scaleFactor).add(centroid);
        let newErrorValue = objectiveFunction(newPoint.values);
        if (newErrorValue < errorValues[errorProfile.highestIndex]) {
            vertices[errorProfile.highestIndex] = newPoint;
            errorValues[errorProfile.highestIndex] = newErrorValue;
        }
        return newErrorValue;
    }

    static shrinkSimplex(errorProfile: ErrorProfile, vertices: Vector[], errorValues: number[],
        objectiveFunction: (x: number[]) => number) {
        let lowestVertex = vertices[errorProfile.lowestIndex];
        for (let i = 0; i < vertices.length; i++) {
            if (i != errorProfile.lowestIndex) {
                vertices[i].add(lowestVertex).multiply(0.5);
                errorValues[i] = objectiveFunction(vertices[i].values);
            }
        }
    }

    static computeCentroid(vertices: Vector[], errorProfile: ErrorProfile) {
        let numVertices = vertices.length;
        let centroid = new Vector(numVertices - 1);
        for (let i=0; i<numVertices; i++) {
            if (i != errorProfile.highestIndex) {
                centroid.add(vertices[i]);
            }
        }
        return centroid.multiply(1.0 / (numVertices - 1));
    }
}
