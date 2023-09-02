import { useEffect } from 'react';
import './App.css';
import * as Cesium from "cesium";
import {JsonStrum} from '@xtao-org/jsonstrum';

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwNzk3NjkyMy1iNGI1LTRkN2UtODRiMy04OTYwYWE0N2M3ZTkiLCJpZCI6Njk1MTcsImlhdCI6MTYzMzU0MTQ3N30.e70dpNzOCDRLDGxRguQCC-tRzGzA-23Xgno5lNgCeB4';

function App() {
  let viewer = null;
  // Size of each point
  const point_size = 5;

  // number of points to generate
  const n_points = 1000000;

  // number of points to display at one time 
  const BATCH_NUM_POINTS = 1;
  const scaler = new Cesium.NearFarScalar(1.5e2, 3, 8.0e6, 1.0);
  // The collection of points
  let points = new Cesium.PointPrimitiveCollection();

  // Add a property to points to track the selected point
  points._selected = {p: null, c: new Cesium.Color()};

  // Create an overlay for showing the point ID
  const nameOverlay = document.createElement("div");

  let n = 0;
  let z_buffer = {};

  function addPoint(point_collection, scaler, pid, x, y, z) {    
    point_collection.add({
        id: pid,
        position: Cesium.Cartesian3.fromDegrees(x, y, z+100.0),
        pixelSize: point_size,
        color: Cesium.Color.CYAN,
        scalByDistance: scaler
      })  
  }

  async function loadPoints(point_collection, src, num_rows) {
      const params = new URLSearchParams({
          q:"source:GEOME",
          rows: num_rows || 100,
          fl: "id,x:producedBy_samplingSite_location_longitude,y:producedBy_samplingSite_location_latitude,z:producedBy_samplingSite_location_elevationInMeters"
      });
      const url = src + "?" + params;
      const scaler = new Cesium.NearFarScalar(1.5e2, 3, 8.0e6, 1.0);
      console.log(`Loading ${url}`);
      const t0 = Date.now();
      fetch(url)
          .then((response) => response.json())
          .then((data) => {
              let n = 0;
              let z_buffer = {};
              const t1 = Date.now();
              data["result-set"].docs.forEach(function (doc) {
                  let pid = doc.id || null;
                  if (pid !== null) {
                    //console.log(doc.id);
                    const k = `${doc.x},${doc.y}`;
                    let z = doc.z || 1.0;
                    if (z_buffer[k] == null) {
                      z_buffer[k] = z;
                    } else {
                      z_buffer[k] = z_buffer[k] + 5.0;
                      z = z_buffer[k]
                    }
                    addPoint(point_collection, scaler, doc.id, doc.x, doc.y, z);
                    n = n +1;
                    if (n % 100000 == 0) {
                      console.log(`n loaded = ${n}`);        
                    }
                  }
              });
              console.log(`n loaded = ${n}`)
              const t2 = Date.now();
              console.log(`${t0} : ${t1} : ${t2}`);
              console.log(`${(t1 - t0)/1000} : ${(t2 - t1)/1000} : ${(t2-t0)/1000}`);
              alert(`${(t1 - t0)/1000} : ${(t2 - t1)/1000} : ${(t2-t0)/1000}`)
          });
  }

  function perdoc_cb(docs, point_collection){
    docs["docs"].forEach(function(doc){
      let pid = doc.id || null;
      if (pid !== null) {
        //console.log(doc.id);
        const k = `${doc.x},${doc.y}`;
        let z = doc.z || 1.0;
        if (z_buffer[k] == null) {
          z_buffer[k] = z;
        } else {
          z_buffer[k] = z_buffer[k] + 5.0;
          z = z_buffer[k]
        }
        addPoint(point_collection, scaler, doc.id, doc.x, doc.y, z);
        n = n +1;
        if (n % 100000 == 0) {
          console.log(`n loaded = ${n}`);        
        }
      }
      console.log(`n loaded = ${n}`)
    })
  }

  async function loadPointsStream(point_collection, src, num_rows){
    const params = new URLSearchParams({
      q:"source:GEOME",
      rows: num_rows || 100,
      fl: "id,x:producedBy_samplingSite_location_longitude,y:producedBy_samplingSite_location_latitude,z:producedBy_samplingSite_location_elevationInMeters"
    });
    const url = src + "?" + params;
    console.log(`Loading ${url}`);
    const t0 = Date.now();
    const response = await fetch(url);
    const t1 = Date.now(); // end time of fetch 

    const strum = JsonStrum({
      object: (object) => perdoc_cb(object, point_collection), // display the point 
      array: (array) => console.log('invalid data type', array),
      level: 1,
    })
    const textDecoder = new TextDecoder('utf-8');
    let buffer = '';
    const reader = response.body.getReader();

    try {
      while (true) {
        // append to buffer each chunk that is read
        let { done, value } = await reader.read();
        if (done) {
          // process what is remained in buffer 
          if (value !== null) {
            try {
              buffer += textDecoder.decode(value);
            }
            catch(error) {
              console.log("Last json object parsing error", buffer);
            }
          }
          break;
        }
        let decoded = textDecoder.decode(value); // decode the stream of bytes to string
        buffer += decoded;
        }
    } catch (error) {
      console.log(error);
    }
    strum.chunk(buffer); // emit and process
    const t2 = Date.now(); // end time of loading points
    console.log(`${t0} : ${t1} : ${t2}`);
    console.log(`${(t1 - t0)/1000} : ${(t2 - t1)/1000} : ${(t2-t0)/1000}`);
    alert(`${(t1 - t0)/1000} : ${(t2 - t1)/1000} : ${(t2-t0)/1000}`)
  }


  // Deselect a point
  function deselect(point_collection) {
      if (point_collection._selected.p !== null) {
          nameOverlay.style.display = "none";
          point_collection._selected.p.primitive.color = point_collection._selected.c;
          point_collection._selected.p.primitive.pixelSize = point_size;
          point_collection._selected.p = null;
      }
  }

  // Select a point
  function select(pt, position, point_collection) {
      if (point_collection._selected.p !== null) {
          if (point_collection._selected.p.id === pt.id) {
              return;
          }
          deselect(point_collection);
      }
      point_collection._selected.p = pt;
      Cesium.Color.clone(pt.primitive.color, point_collection._selected.c);
      point_collection._selected.p.primitive.color = Cesium.Color.YELLOW;
      point_collection._selected.p.primitive.pixelSize = 10;
      // Can also use this to transform feature coords to window
      // const window_pos = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, pt.primitive.position);
      const toppos = viewer.canvas.getBoundingClientRect().top + window.scrollY;
      nameOverlay.style.display = "block";
      // 30 is the vertical offset of the top of the element to the position
      // Depends on the hight of the text and the border etc of the element
      nameOverlay.style.top = `${toppos + position.y - 30}px`;
      nameOverlay.style.left = `${position.x + 10}px`;
      const name = point_collection._selected.p.id;
      nameOverlay.textContent = name;
  }

  async function doLoadPoints() {
      const src = "http://localhost:8010/proxy/isamples_central/thing/stream";
      loadPointsStream(points, src, n_points); 
      // loadPoints(points, src, n_points)
  }

  useEffect(() => {
    if (viewer === null){
      viewer = new Cesium.Viewer("cesiumContainer", {
        terrain: Cesium.Terrain.fromWorldTerrain()
      });
         // Add points to the viewer
      viewer.scene.primitives.add(points);

      viewer.container.appendChild(nameOverlay);
      nameOverlay.className = "backdrop";
      nameOverlay.style.display = "none";
      nameOverlay.style.position = "absolute";
      //nameOverlay.style.bottom = "0";
      nameOverlay.style.left = "0";
      nameOverlay.style["pointer-events"] = "none";
      nameOverlay.style.padding = "4px";
      nameOverlay.style.height = "15px";
      nameOverlay.style.backgroundColor = "black";
      nameOverlay.style.color = "white";

      // Handler responding to mouse move events
      var handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction(function (movement) {
          // Check what is under the mouse cursor
          var pickedObject = viewer.scene.pick(movement.endPosition);
          if (Cesium.defined(pickedObject)) {
              // if the feature is in the points collection...
              if (pickedObject.collection === points) {
                  select(pickedObject, movement.endPosition, points);
              }
          } else {
              deselect(points);
          }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

 
    // create the points, except delay when we start generating
    const timeout = setTimeout(doLoadPoints, 1000);
    return () => {
      // clears timeout before running the new effect
      clearTimeout(timeout);
    };
  },[])

  return (
      <body>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
        <div id="cesiumContainer" class="fullSize"></div>
      </body>
  );
}

export default App;
