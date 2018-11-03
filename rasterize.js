/* GLOBAL CONSTANTS AND VARIABLES */

var canvas;

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog2/lights.json"; // lights file loc
var ViewUp = new vec4.fromValues(0.0,1.0,0.0,0.0); // default ViewUp vector
var LookAt = new vec4.fromValues(0.0,0.0,1.0,0.0); // default LookAt vector
var LookAtP = new vec4.fromValues(0.5,0.5,0.0,1.0); // default LookAt point, AKA center

var ViewX = new vec4.fromValues(1.0,0.0,0.0,0.0); // default View X-axis vector
var ViewY = new vec4.fromValues(0.0,1.0,0.0,0.0); // default View Y-axis vector
var ViewZ = new vec4.fromValues(0.0,0.0,1.0,0.0); // default View Z-axis vector

var shadingMode = 1; // 1 for Blinn-Phong shading, 0 for Phong shading

/* input globals */
var inputTriangles; // the triangles read in from json
var numTriangleSets = 0; // the number of sets of triangles
var triSetSizes = []; // the number of triangles in each set

var inputLights; // The lights read in from json

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffers = []; // this contains vertex coordinates in triples, organized by tri set
var triangleBuffers = []; // this contains indices into vertexBuffers in triples, organized by tri set
var vertexPositionAttrib; // where to put position for vertex shader
var modelMatrixULoc; // where to put the model matrix for vertex shader

var normalBuffers = []; // this contains vertex normals in triples
var vertexNormalAttrib; // where to put normal for vertex shader

var modelviewMatrixULoc; // where to put the global modelview matrix
var projectionMatrixULoc; // where to put the global projection matrix

var materialAmbientULoc; // where to put the material ambient properties
var materialDiffuseULoc; // where to put the material diffuse properties
var materialSpecularULoc; // where to put the material specular properties
var materialShininessULoc; // where to put the material specular exponent 

var lightAmbientULoc; // where to put the light ambient properties
var lightDiffuseULoc; // where to put the light diffuse properties
var lightSpecularULoc; // where to put the light specular properties
var lightPositionULoc; // where to put the light direction

var triangleNormalULoc; // where to put the triangle normal
var normalMatrixULoc; // where to put the normal matrix

var shadingULoc; // where to put shading mode location

var selection = 0; // 1 for on, 0 for off
var selectionIndex = 0; // the index of selection


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd; // vtx coords to add to the coord array
        var triToAdd; // tri indices to add to the index array

        var whichSetNorm; // index of the vertex normal in the current triangle set
        var normToAdd; // norm vector to add to the norm array

        // for each set of tris in the input file
        numTriangleSets = inputTriangles.length;
        for (var whichSet=0; whichSet<numTriangleSets; whichSet++) {

            // define the modeling, rotation, and normal matrix for each set
            inputTriangles[whichSet].mMatrix = mat4.create(); // modeling mat for tri set
            inputTriangles[whichSet].rMatrix = mat4.create(); // rotation mat for tri set
            inputTriangles[whichSet].nMatrix = mat3.create(); // normal mat for tri set
            inputTriangles[whichSet].yaw = 0; // modeling mat for tri set
            inputTriangles[whichSet].pitch = 0; // rotation mat for tri set
            inputTriangles[whichSet].roll = 0; // normal mat for tri set
            
            // set up the vertex normal array
            inputTriangles[whichSet].normalArray = []; // create a list of normals for this tri set
            for (whichSetNorm=0; whichSetNorm<inputTriangles[whichSet].normals.length; whichSetNorm++) {
                normToAdd = inputTriangles[whichSet].normals[whichSetNorm];
                inputTriangles[whichSet].normalArray.push(normToAdd[0],normToAdd[1],normToAdd[2]);
            } // end for normals in set

            // send the vertex normalss to webGL
            normalBuffers[whichSet] = gl.createBuffer(); // init empty vertex coord buffer for current set
            gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].normalArray),gl.STATIC_DRAW); // coords to that buffer
            

            // set up the vertex coord array
            inputTriangles[whichSet].coordArray = []; // create a list of coords for this tri set
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                inputTriangles[whichSet].coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
            } // end for vertices in set

            // send the vertex coords to webGL
            vertexBuffers[whichSet] = gl.createBuffer(); // init empty vertex coord buffer for current set
            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].coordArray),gl.STATIC_DRAW); // coords to that buffer
            
            // set up the triangle index array, adjusting indices across sets
            inputTriangles[whichSet].indexArray = []; // create a list of tri indices for this tri set
            triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length;
            for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                triToAdd = inputTriangles[whichSet].triangles[whichSetTri];
                inputTriangles[whichSet].indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
            } // end for triangles in set

            // send the triangle indices to webGL
            triangleBuffers[whichSet] = gl.createBuffer(); // init empty triangle index buffer for current tri set
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].indexArray),gl.STATIC_DRAW); // indices to that buffer
            
            // find center of each tri set(use avg)
            inputTriangles[whichSet].center = vec3.create();
            var n = inputTriangles[whichSet].vertices.length;
            for(whichSetVert=0; whichSetVert<n; whichSetVert++) {
                var vtx = inputTriangles[whichSet].vertices[whichSetVert];
                vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vec3.fromValues(vtx[0], vtx[1], vtx[2]));
            }
            vec3.div(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vec3.fromValues(n, n, n));

        } // end for each triangle set 
    } // end if triangles found
} // end load triangles

function loadLights() {
    inputLights = getJSONFile(INPUT_LIGHTS_URL,"lights");
    if (inputLights != String.null) {
        //gl.uniform3fv(lightAmbientULoc, inputLights[0].ambient);
        //gl.uniform3fv(lightDiffuseULoc, inputLights[0].diffuse);
        //gl.uniform3fv(lightSpecularULoc, inputLights[0].specular);
        //gl.uniform3f(lightPositionULoc, inputLights[0].x, inputLights[0].y, inputLights[0].z);
    }

}

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        uniform vec3 uMaterialAmbient; // the material ambient color
        uniform vec3 uMaterialDiffuse; // the material diffuse color
        uniform vec3 uMaterialSpecular; // the material specular color
        uniform float uMaterialShininess; // the material shininess

        uniform vec3 uLightAmbient; // the light ambient color
        uniform vec3 uLightDiffuse; // the light diffuse color
        uniform vec3 uLightSpecular; // the light specular color
        uniform vec3 uLightPosition; // the light position

        uniform vec3 uTriangleNormal; // the triangle normal
        varying vec3 vTriangleNormal; // the triangle normal
        uniform mat3 uNormalMatrix; // the normal matrix

        uniform mat4 uModelviewMatrix; // the modelview matrix (same for each obj)

        uniform int uShadingMode; // 1 for Blinn-Phong shading, 0 for Phong shading

        varying vec3 vEyeCoords;
        varying vec3 vVertexNormal;
        
        void main(void) {
            vec3 N, L, V, R, H;
            //N = normalize(uNormalMatrix * vTriangleNormal); // use triangle normal
            N = normalize(uNormalMatrix * vVertexNormal); // use vertex normals
            vec3 lightPosition = (uModelviewMatrix * vec4(uLightPosition, 1.0)).xyz;
            vec3 coords = reflect(vEyeCoords, vec3(0.0, 1.0, 0.0));
            //L = normalize(lightPosition - coords);
            //L = normalize(uLightPosition - vEyeCoords);
            L = normalize(lightPosition - vEyeCoords);
            V = normalize(-vEyeCoords);
            R = -reflect(L,N);
            H = normalize(L + V);

            if (dot(N, L) > 0.0) {
                vec3 ambient, diffuse, specular, color;
                ambient = uLightAmbient * uMaterialAmbient;
                diffuse = uLightDiffuse * uMaterialDiffuse * max(dot(N, L),0.0);

                if (uShadingMode == 1) { // do Blinn-Phong shading
                    specular = uLightSpecular * uMaterialSpecular * pow(max(dot(N, H),0.0), uMaterialShininess);
                }
                else { // do Phong shading
                    specular = uLightSpecular * uMaterialSpecular * pow(max(dot(R, V),0.0), uMaterialShininess);
                    //specular = vec3(0.0,0.0,1.0);
                }
                color = ambient + diffuse + specular;
                //color = vec3(dot(N, L), dot(N, H), dot(R, V));
                //color = vec3(dot(N, L), dot(N, L), dot(N, L));
                //color = N;
                //gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // all fragments are white
                //gl_FragColor = vec4(uMaterialDiffuse, 1.0); // all fragments are diffuse material color
                gl_FragColor = vec4(color, 1.0);
            }
            else {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            }
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexNormal;
        attribute vec3 vertexPosition;
        uniform mat4 uModelMatrix; // the model matrix (dif for each obj)
        uniform mat4 uModelviewMatrix; // the modelview matrix (same for each obj)
        uniform mat4 uProjectionMatrix; // the projection matrix (same for each obj)
        uniform vec3 uTriangleNormal; // the triangle normal
        varying vec3 vTriangleNormal; // the triangle normal
        varying vec3 vEyeCoords;
        varying vec3 vVertexNormal;

        void main(void) {
            vec4 eyeCoords = uModelviewMatrix * uModelMatrix * vec4(vertexPosition, 1.0);
            //gl_Position = uModelMatrix * vec4(vertexPosition, 1.0);
            gl_Position = uProjectionMatrix * uModelviewMatrix * uModelMatrix * vec4(vertexPosition, 1.0);
            vEyeCoords = eyeCoords.xyz/eyeCoords.w;
            vTriangleNormal = normalize(uTriangleNormal);
            vVertexNormal = normalize(vertexNormal);
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                modelMatrixULoc = gl.getUniformLocation(shaderProgram, "uModelMatrix"); // ptr to mmat

                modelviewMatrixULoc = gl.getUniformLocation(shaderProgram, "uModelviewMatrix");
                projectionMatrixULoc = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
                
                materialAmbientULoc = gl.getUniformLocation(shaderProgram, "uMaterialAmbient");
                materialDiffuseULoc = gl.getUniformLocation(shaderProgram, "uMaterialDiffuse");
                materialSpecularULoc = gl.getUniformLocation(shaderProgram, "uMaterialSpecular");
                materialShininessULoc = gl.getUniformLocation(shaderProgram, "uMaterialShininess");

                lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient");
                lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse");
                lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular");
                lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition");

                triangleNormalULoc = gl.getUniformLocation(shaderProgram, "uTriangleNormal");
                normalMatrixULoc = gl.getUniformLocation(shaderProgram, "uNormalMatrix");

                shadingULoc = gl.getUniformLocation(shaderProgram, "uShadingMode");

                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexNormalAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexNormal"); 

                gl.enableVertexAttribArray(vertexNormalAttrib); // input to shader from array
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    gl.uniform1i(shadingULoc, shadingMode);

    gl.uniform3fv(lightAmbientULoc, inputLights[0].ambient);
    gl.uniform3fv(lightDiffuseULoc, inputLights[0].diffuse);
    gl.uniform3fv(lightSpecularULoc, inputLights[0].specular);
    gl.uniform3f(lightPositionULoc, inputLights[0].x, inputLights[0].y, inputLights[0].z);
    //gl.uniform3f(lightPositionULoc, 0.0, 1.0, 10.5);


    // define the perspective matrix
    var perspective = mat4.create();
    mat4.perspective(perspective, Math.PI/2, 1, 0.1, 100);
    gl.uniformMatrix4fv(projectionMatrixULoc, false, perspective);

    // define the modelview matrix
    var modelview = mat4.create();
    //mat4.lookAt(modelview, [0.5,0.5,-0.5], [0.5,0.5,0.0], [0.0,1.0,0.0]);
    mat4.lookAt(modelview, Eye, LookAtP, ViewUp);
    gl.uniformMatrix4fv(modelviewMatrixULoc, false, modelview);

    // define the selecion/scaling matrix for each set
    for (var f = 0; f < numTriangleSets; f++) {
        inputTriangles[f].sMatrix = mat4.create(); // scaling mat for tri set
    }
    
    // define the modeling matrix for the first set 
    //inputTriangles[0].mMatrix = mat4.create(); // modeling mat for tri set
    //inputTriangles[0].nMatrix = mat3.create(); // normal mat for tri set
    /*
    var setCenter = vec3.fromValues(.25,.75,0);  // center coords of tri set 
    mat4.fromTranslation(inputTriangles[0].mMatrix,vec3.negate(vec3.create(),setCenter)); // translate to origin
    mat4.multiply(inputTriangles[0].mMatrix,
                  mat4.fromRotation(mat4.create(),Math.PI/2,vec3.fromValues(0,0,1)),
                  inputTriangles[0].mMatrix); // rotate 90 degs
    mat4.multiply(inputTriangles[0].mMatrix,
                  mat4.fromTranslation(mat4.create(),setCenter),
                  inputTriangles[0].mMatrix); // move back to center
    mat4.multiply(inputTriangles[0].mMatrix,
                  mat4.fromRotation(mat4.create(),Math.PI/4,vec3.fromValues(0,0,1)),
                  inputTriangles[0].mMatrix); // rotate 45 degs
    mat4.multiply(inputTriangles[0].mMatrix,
                  mat4.fromTranslation(mat4.create(),vec3.fromValues(-.40,-.90,0)),
                  inputTriangles[0].mMatrix); // move (-.40,-.90)*/
        
    // define the modeling matrix for the second set
    //inputTriangles[1].mMatrix = mat4.create();
    //inputTriangles[1].nMatrix = mat3.create(); // normal mat for tri set
    /*
    setCenter = vec3.fromValues(.10,.25,.75);  // center coords of tri set 
    mat4.fromTranslation(inputTriangles[1].mMatrix,vec3.negate(vec3.create(),setCenter)); // translate to origin
    mat4.multiply(inputTriangles[1].mMatrix,
                  mat4.fromScaling(mat4.create(), vec3.fromValues(2,2,0)),
                  inputTriangles[1].mMatrix); // rotate 90 degs
    mat4.multiply(inputTriangles[1].mMatrix,
                  mat4.fromTranslation(mat4.create(),setCenter),
                  inputTriangles[1].mMatrix); // move back to center
    mat4.multiply(inputTriangles[1].mMatrix,
                  mat4.fromRotation(mat4.create(),Math.PI/4,vec3.fromValues(0,0,1)),
                  inputTriangles[1].mMatrix); // rotate 45 degs
    mat4.multiply(inputTriangles[1].mMatrix,
                  mat4.fromTranslation(mat4.create(),vec3.fromValues(-.40,-.90,0)),
                  inputTriangles[1].mMatrix); // move (-.40,-.90)*/

    if(selection == 1) {
        var center = inputTriangles[selectionIndex].center;
        mat4.fromTranslation(inputTriangles[selectionIndex].sMatrix,vec3.negate(vec3.create(), center)); // translate to origin
        mat4.multiply(inputTriangles[selectionIndex].sMatrix,
                  mat4.fromScaling(mat4.create(), vec3.fromValues(1.2,1.2,1.2)),
                  inputTriangles[selectionIndex].sMatrix); // scale up by 20%
        mat4.multiply(inputTriangles[selectionIndex].sMatrix,
                  mat4.fromTranslation(mat4.create(),center),
                  inputTriangles[selectionIndex].sMatrix); // move back to center*/
    }
    
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) { 
        
        // pass material diffuse property for set to shader
        gl.uniform3fv(materialAmbientULoc, inputTriangles[whichTriSet].material.ambient);
        gl.uniform3fv(materialDiffuseULoc, inputTriangles[whichTriSet].material.diffuse);
        gl.uniform3fv(materialSpecularULoc, inputTriangles[whichTriSet].material.specular);
        gl.uniform1f(materialShininessULoc, inputTriangles[whichTriSet].material.n);

        //pass triangle normal to shader
        gl.uniform3fv(triangleNormalULoc, inputTriangles[whichTriSet].normals[0]);
        
        // pass modeling matrix for set to shader
        var modelMatrix = mat4.create();
        /*mat4.multiply(modelMatrix,
                  inputTriangles[whichTriSet].sMatrix,
                  inputTriangles[whichTriSet].mMatrix);*/
        mat4.multiply(modelMatrix,
                  inputTriangles[whichTriSet].rMatrix,
                  modelMatrix);
        mat4.multiply(modelMatrix,
                  inputTriangles[whichTriSet].mMatrix,
                  modelMatrix);
        mat4.multiply(modelMatrix,
                inputTriangles[whichTriSet].sMatrix,
                modelMatrix);
        gl.uniformMatrix4fv(modelMatrixULoc, false, modelMatrix);

        // pass normal matrix for set to shader
        var mat = mat4.create();
        mat4.multiply(mat,
                  modelMatrix,
                  mat);
        mat4.multiply(mat,
                  modelview,
                  mat);
        //mat3.normalFromMat4(inputTriangles[whichTriSet].nMatrix, modelview);
        mat3.normalFromMat4(inputTriangles[whichTriSet].nMatrix, mat);
        gl.uniformMatrix3fv(normalMatrixULoc, false, inputTriangles[whichTriSet].nMatrix);
        
        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

        // normal buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
        
    } // end for each tri set
} // end render triangles

window.addEventListener("keydown", keysPressed, false);
window.addEventListener("keyup", keysReleased, false);
 
var keys = [];
 
function keysPressed(e) {
    // store an entry for every key pressed
    keys[e.keyCode] = true;

    if (keys[16] && keys[65]) {
        //alert("The 'A' key is pressed.");
        vec4.transformMat4(ViewUp, ViewUp, mat4.fromRotation(mat4.create(), Math.PI/180, ViewY));
        vec4.transformMat4(ViewX, ViewX, mat4.fromRotation(mat4.create(), Math.PI/180, ViewY));
        vec4.transformMat4(ViewZ, ViewZ, mat4.fromRotation(mat4.create(), Math.PI/180, ViewY));
        vec4.add(LookAtP, Eye, ViewZ);
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[68]) {
        //alert("The 'D' key is pressed.");
        vec4.transformMat4(ViewUp, ViewUp, mat4.fromRotation(mat4.create(), -Math.PI/180, ViewY));
        vec4.transformMat4(ViewX, ViewX, mat4.fromRotation(mat4.create(), -Math.PI/180, ViewY));
        vec4.transformMat4(ViewZ, ViewZ, mat4.fromRotation(mat4.create(), -Math.PI/180, ViewY));
        vec4.add(LookAtP, Eye, ViewZ);
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[87]) {
        //alert("The 'W' key is pressed.");
        vec4.transformMat4(ViewUp, ViewUp, mat4.fromRotation(mat4.create(), -Math.PI/180, ViewX));
        vec4.transformMat4(ViewY, ViewY, mat4.fromRotation(mat4.create(), -Math.PI/180, ViewX));
        vec4.transformMat4(ViewZ, ViewZ, mat4.fromRotation(mat4.create(), -Math.PI/180, ViewX));
        vec4.add(LookAtP, Eye, ViewZ);
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[83]) {
        //alert("The 'S' key is pressed.");
        vec4.transformMat4(ViewUp, ViewUp, mat4.fromRotation(mat4.create(), Math.PI/180, ViewX));
        vec4.transformMat4(ViewY, ViewY, mat4.fromRotation(mat4.create(), Math.PI/180, ViewX));
        vec4.transformMat4(ViewZ, ViewZ, mat4.fromRotation(mat4.create(), Math.PI/180, ViewX));
        vec4.add(LookAtP, Eye, ViewZ);
        requestAnimationFrame(renderTriangles);
    } else if (keys[65]) {
        //alert("The 'a' key is pressed.");
        var dir = vec4.create();
        vec4.multiply(dir, ViewX, vec4.fromValues(0.1,0.1,0.1,0.0));
        vec4.add(LookAtP, LookAtP, dir);
        vec4.add(Eye, Eye, dir);
        requestAnimationFrame(renderTriangles);
    } else if (keys[68]) {
        //alert("The 'd' key is pressed.");
        var dir = vec4.create();
        vec4.multiply(dir, ViewX, vec4.fromValues(-0.1,-0.1,-0.1,0.0));
        vec4.add(LookAtP, LookAtP, dir);
        vec4.add(Eye, Eye, dir);
        requestAnimationFrame(renderTriangles);
    } else if (keys[87]) {
        //alert("The 'w' key is pressed.");
        var dir = vec4.create();
        vec4.multiply(dir, ViewZ, vec4.fromValues(0.1,0.1,0.1,0.0));
        vec4.add(LookAtP, LookAtP, dir);
        vec4.add(Eye, Eye, dir);
        requestAnimationFrame(renderTriangles);
    } else if (keys[83]) {
        //alert("The 's' key is pressed.");
        var dir = vec4.create();
        vec4.multiply(dir, ViewZ, vec4.fromValues(-0.1,-0.1,-0.1,0.0));
        vec4.add(LookAtP, LookAtP, dir);
        vec4.add(Eye, Eye, dir);
        requestAnimationFrame(renderTriangles);
    } else if (keys[81]) {
        //alert("The 'q' key is pressed.");
        var dir = vec4.create();
        vec4.multiply(dir, ViewY, vec4.fromValues(0.1,0.1,0.1,0.0));
        vec4.add(LookAtP, LookAtP, dir);
        vec4.add(Eye, Eye, dir);
        requestAnimationFrame(renderTriangles);
    } else if (keys[69]) {
        //alert("The 'e' key is pressed.");
        var dir = vec4.create();
        vec4.multiply(dir, ViewY, vec4.fromValues(-0.1,-0.1,-0.1,0.0));
        vec4.add(LookAtP, LookAtP, dir);
        vec4.add(Eye, Eye, dir);
        requestAnimationFrame(renderTriangles);
    } else if (keys[37]) { //left
        if(selection == 0) {
            selection = 1;
        } else {
            selectionIndex--;
            if (selectionIndex < 0)
                selectionIndex = numTriangleSets - 1;
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[39]) { //right
        if(selection == 0) {
            selection = 1;
        } else {
            selectionIndex++;
            if (selectionIndex > numTriangleSets - 1)
                selectionIndex = 0;
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[32]) { //space
        selection = 0;
        selectionIndex = 0;
        requestAnimationFrame(renderTriangles);
    } else if (keys[66]) { //b
        shadingMode++;
        if (shadingMode > 1)
            shadingMode = 0;
        requestAnimationFrame(renderTriangles);
    } else if (keys[78]) { //n
        if (selection == 1) {
            inputTriangles[selectionIndex].material.n++;
            if(inputTriangles[selectionIndex].material.n > 20)
                inputTriangles[selectionIndex].material.n = 0;
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[49]) { //1
        if (selection == 1) {
            inputTriangles[selectionIndex].material.ambient[0] += 0.1;
            inputTriangles[selectionIndex].material.ambient[1] += 0.1;
            inputTriangles[selectionIndex].material.ambient[2] += 0.1;
            if(inputTriangles[selectionIndex].material.ambient[0] > 1.0)
                inputTriangles[selectionIndex].material.ambient[0] = 0.0;
            if(inputTriangles[selectionIndex].material.ambient[1] > 1.0)
                inputTriangles[selectionIndex].material.ambient[1] = 0.0;
            if(inputTriangles[selectionIndex].material.ambient[2] > 1.0)
                inputTriangles[selectionIndex].material.ambient[2] = 0.0;
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[50]) { //2
        if (selection == 1) {
            inputTriangles[selectionIndex].material.diffuse[0] += 0.1;
            inputTriangles[selectionIndex].material.diffuse[1] += 0.1;
            inputTriangles[selectionIndex].material.diffuse[2] += 0.1;
            if(inputTriangles[selectionIndex].material.diffuse[0] > 1.0)
                inputTriangles[selectionIndex].material.diffuse[0] = 0.0;
            if(inputTriangles[selectionIndex].material.diffuse[1] > 1.0)
                inputTriangles[selectionIndex].material.diffuse[1] = 0.0;
            if(inputTriangles[selectionIndex].material.diffuse[2] > 1.0)
                inputTriangles[selectionIndex].material.diffuse[2] = 0.0;
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[51]) { //3
        if (selection == 1) {
            inputTriangles[selectionIndex].material.specular[0] += 0.1;
            inputTriangles[selectionIndex].material.specular[1] += 0.1;
            inputTriangles[selectionIndex].material.specular[2] += 0.1;
            if(inputTriangles[selectionIndex].material.specular[0] > 1.0)
                inputTriangles[selectionIndex].material.specular[0] = 0.0;
            if(inputTriangles[selectionIndex].material.specular[1] > 1.0)
                inputTriangles[selectionIndex].material.specular[1] = 0.0;
            if(inputTriangles[selectionIndex].material.specular[2] > 1.0)
                inputTriangles[selectionIndex].material.specular[2] = 0.0;
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[75]) { //K
        if (selection == 1) {
            var setCenter = inputTriangles[selectionIndex].center;
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(), setCenter)),
                inputTriangles[selectionIndex].rMatrix); // translate to origin
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromRotation(mat4.create(),Math.PI/180,ViewY),
                inputTriangles[selectionIndex].rMatrix); // rotate 1 deg
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),setCenter),
                inputTriangles[selectionIndex].rMatrix); // move back to center
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[186]) { //:
        if (selection == 1) {
            var setCenter = inputTriangles[selectionIndex].center;
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(), setCenter)),
                inputTriangles[selectionIndex].rMatrix); // translate to origin
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromRotation(mat4.create(),-Math.PI/180,ViewY),
                inputTriangles[selectionIndex].rMatrix); // rotate 1 deg
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),setCenter),
                inputTriangles[selectionIndex].rMatrix); // move back to center
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[79]) { //O
        if (selection == 1) {
            var setCenter = inputTriangles[selectionIndex].center;
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(), setCenter)),
                inputTriangles[selectionIndex].rMatrix); // translate to origin
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromRotation(mat4.create(),Math.PI/180,ViewX),
                inputTriangles[selectionIndex].rMatrix); // rotate 1 deg
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),setCenter),
                inputTriangles[selectionIndex].rMatrix); // move back to center
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[76]) { //L
        if (selection == 1) {
            var setCenter = inputTriangles[selectionIndex].center;
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(), setCenter)),
                inputTriangles[selectionIndex].rMatrix); // translate to origin
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromRotation(mat4.create(),-Math.PI/180,ViewX),
                inputTriangles[selectionIndex].rMatrix); // rotate 1 deg
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),setCenter),
                inputTriangles[selectionIndex].rMatrix); // move back to center
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[73]) { //I
        if (selection == 1) {
            var setCenter = inputTriangles[selectionIndex].center;
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(), setCenter)),
                inputTriangles[selectionIndex].rMatrix); // translate to origin
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromRotation(mat4.create(),Math.PI/180,ViewZ),
                inputTriangles[selectionIndex].rMatrix); // rotate 1 deg
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),setCenter),
                inputTriangles[selectionIndex].rMatrix); // move back to center
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[16] && keys[80]) { //P
        if (selection == 1) {
            var setCenter = inputTriangles[selectionIndex].center;
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),vec3.negate(vec3.create(), setCenter)),
                inputTriangles[selectionIndex].rMatrix); // translate to origin
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromRotation(mat4.create(),-Math.PI/180,ViewZ),
                inputTriangles[selectionIndex].rMatrix); // rotate 1 deg
            mat4.multiply(inputTriangles[selectionIndex].rMatrix,
                mat4.fromTranslation(mat4.create(),setCenter),
                inputTriangles[selectionIndex].rMatrix); // move back to center
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[75]) { //k
        if (selection == 1) {
            var dir = vec4.create();
            vec4.multiply(dir, ViewX, vec4.fromValues(0.1,0.1,0.1,0.0));
            mat4.multiply(inputTriangles[selectionIndex].mMatrix,
                inputTriangles[selectionIndex].mMatrix,
                mat4.fromTranslation(mat4.create(), dir));
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[186]) { //;
        if (selection == 1) {
            var dir = vec4.create();
            vec4.multiply(dir, ViewX, vec4.fromValues(-0.1,-0.1,-0.1,0.0));
            mat4.multiply(inputTriangles[selectionIndex].mMatrix,
                inputTriangles[selectionIndex].mMatrix,
                mat4.fromTranslation(mat4.create(), dir));
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[79]) { //o
        if (selection == 1) {
            var dir = vec4.create();
            vec4.multiply(dir, ViewZ, vec4.fromValues(0.1,0.1,0.1,0.0));
            mat4.multiply(inputTriangles[selectionIndex].mMatrix,
                inputTriangles[selectionIndex].mMatrix,
                mat4.fromTranslation(mat4.create(), dir));
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[76]) { //l
        if (selection == 1) {
            var dir = vec4.create();
            vec4.multiply(dir, ViewZ, vec4.fromValues(-0.1,-0.1,-0.1,0.0));
            mat4.multiply(inputTriangles[selectionIndex].mMatrix,
                inputTriangles[selectionIndex].mMatrix,
                mat4.fromTranslation(mat4.create(), dir));
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[73]) { //i
        if (selection == 1) {
            var dir = vec4.create();
            vec4.multiply(dir, ViewY, vec4.fromValues(0.1,0.1,0.1,0.0));
            mat4.multiply(inputTriangles[selectionIndex].mMatrix,
                inputTriangles[selectionIndex].mMatrix,
                mat4.fromTranslation(mat4.create(), dir));
        }
        requestAnimationFrame(renderTriangles);
    } else if (keys[80]) { //p
        if (selection == 1) {
            var dir = vec4.create();
            vec4.multiply(dir, ViewY, vec4.fromValues(-0.1,-0.1,-0.1,0.0));
            mat4.multiply(inputTriangles[selectionIndex].mMatrix,
                inputTriangles[selectionIndex].mMatrix,
                mat4.fromTranslation(mat4.create(), dir));
        }
        requestAnimationFrame(renderTriangles);
    }



}

function keysReleased(e) {
    // mark keys that were released
    keys[e.keyCode] = false;
}

/*function Update() {
    requestAnimationFrame(renderTriangles);
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    renderTriangles();
    Update();
}*/

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  loadLights(); // load in the lights from the lights file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL

  //renderLoop();
} // end main
