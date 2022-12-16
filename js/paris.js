const ctx = {
    w: 800,
    h: 400,
    TRANSITION_DURATION: 1000,
    DURATION_BETWEEN_UPDATES: 5000,
    SRC_LOCAL: "LocalDump",
    SRC_OS: "OpenSky",
    scale: 1,
    currentFlights: [],
    planeUpdater: null,
    LA_MIN: 41.31,
    LA_MAX: 51.16,
    LO_MIN: -4.93,
    LO_MAX: 7.72,
    curPath: [],
};

// const SRC = ctx.SRC_OS;
// local dump fallback if too many requests to online service
const SRC = ctx.SRC_LOCAL;
// iterate over:
// opensky_20221130T1349.json
// opensky_20221130T1350.json
// opensky_20221130T1351.json
// opensky_20221130T1352.json
// opensky_20221130T1353.json
const LOCAL_DUMP_TIME_INDICES = [...Array(5).keys()].map(i => i + 49);
let LOCAL_DUMP_TIME_INC = 1;

const PROJECTIONS = {
    ER: d3.geoEquirectangular().center([2.3488000,48.8534100]).scale(160000)
          .translate([ctx.w/2,ctx.h/2]),
};

const path4proj = d3.geoPath()
                  .projection(PROJECTIONS.ER);

function distanceNaive(d){
    for (let i = 0; i < ctx.test.length; i++) {
        // console.log("ola");
        if (ctx.test[i].month==1 && ctx.test[i].sourceid == ctx.selected && ctx.test[i].dstid == d.properties.MOVEMENT_ID) {
            console.log(ctx.test[i].mean_travel_time)
            return ctx.test[i].mean_travel_time;
        }
      }
    return 0;
}

function distance(d){
    if (d.properties.MOVEMENT_ID == ctx.selected) return -1;
    for (let i = 0; i < ctx.filtered.length; i++) {
        // console.log("ola");
        if (ctx.filtered[i].dstid == d.properties.MOVEMENT_ID) {
            console.log(ctx.filtered[i].mean_travel_time)
            return ctx.filtered[i].mean_travel_time;
        }
      }
}

function drawMap(zonesData, waterData, greenData, roadData, svgEl){
    ctx.mapG = svgEl.append("g")
                    .attr("id", "map");
    // bind and draw geographical features to <path> elements
    let path4proj = d3.geoPath()
                 .projection(PROJECTIONS.ER);

    let backgroundMap = ctx.mapG.append("g").attr("id", "backgroundMap");
    let zones = backgroundMap.append("g").attr("id", "zones");

    let landmarks = ctx.mapG.append("g").attr("id", "landmarks").attr("pointer-events", "none");
    let water = landmarks.append("g").attr("id", "waterSpaces");
    let green = landmarks.append("g").attr("id", "greenSpaces");
    let roads = landmarks.append("g").attr("id", "roadSpaces");

    let overlay = ctx.mapG.append("g").attr("id", "overlay");
    let hover = overlay.append("g").attr("id", "hover");
    let selected = overlay.append("g").attr("id", "selected");

    zones.selectAll("path.zone")
            .data(zonesData.features)
            .enter()
            .append("path")
            .attr("d", path4proj)
            .attr("class", "zone")
            .style("fill", "black")
            .style("stroke", "none")
            .style("stroke-width", "0.5")
            .on("mouseover", function(event,d) {
                console.log(d.properties.MOVEMENT_ID);
                thisNode = d3.select(this);
                hover.selectAll("path")
                    .remove();
                hover.node()
                    .appendChild(thisNode.node().cloneNode());
                hover.selectAll("path")
                    .style("stroke", "blue")
                    .style("fill", "blue")
                    .style("opacity", 0.6)
                    .style("stroke-width", "0")
                    .attr("pointer-events", "none");

                if (ctx.selected) {
                    d3.select("#info").text(distance(d))
                };
            })
            .on("click", function(event, d) {
                thisNode = d3.select(this);
                selected.selectAll("path").remove();
                selected.node().appendChild(thisNode.node().cloneNode());
                selected.selectAll("path")
                    .style("stroke", "red")
                    .style("fill", "none")
                    .style("stroke-width", 1.5*ctx.scale)
                    .attr("pointer-events", "none");
                console.log(selected.selectAll("path"));

                ctx.selected = d.properties.MOVEMENT_ID;
                ctx.filtered = ctx.distances.filter(d => d.sourceid == ctx.selected);

                zones.selectAll("path.zone")
                    .style("fill", function(d) {
                        dist = distance(d);
                        return dist ? d3.interpolateRdYlGn(Math.exp(-dist/500 )) : "black";});
                green.selectAll("path.green")
                    .style("opacity", 0.5);
            });


    water.selectAll("path.water")
        .data(waterData.features)
        .enter()
        .append("path")
        .attr("d", path4proj)
        .attr("class", "water")
        .style("fill", "lightblue");
    green.selectAll("path.green")
        .data(greenData.features)
        .enter()
        .append("path")
        .attr("d", path4proj)
        .attr("class", "green")
        .style("fill", "#daffb3");
    roads.selectAll("path.road")
        .data(roadData.features)
        .enter()
        .append("path")
        .attr("d", path4proj)
        .attr("class", "road")
        .style("fill", "#e6e6e6");
    

    ctx.mapG.append("g")
            .attr("id", "planes");
    ctx.mapG.append("g")
            .attr("id", "waypoints");
    
    // pan & zoom
    function zoomed(event, d) {
      ctx.mapG.attr("transform", event.transform);
      let scale = ctx.mapG.attr("transform");
      scale = scale.substring(scale.indexOf('scale(')+6);
      scale = parseFloat(scale.substring(0, scale.indexOf(')')));
      ctx.scale = 1 / scale;
      selected.selectAll("path").style("stroke-width", 1.5*ctx.scale);
      if (ctx.scale != 1){
          d3.selectAll("image")
            .attr("transform", (d) => (getPlaneTransform(d)));
          d3.selectAll("circle")
            .attr("transform", (d) => (getPlaneTransform(d)));
      }
    }
    let zoom = d3.zoom()
        .scaleExtent([1, 40])
        .on("zoom", zoomed);
    svgEl.call(zoom);
};

function createViz(){
    d3.select("body")
      .on("keydown", (event,d) => (handleKeyEvent(event)));
    let svgEl = d3.select("#main").append("svg");
    svgEl.attr("width", "100%");
    svgEl.attr("height", "100vh");
    svgEl.append("rect")
         .attr("x", 0)
         .attr("y", 0)
         .attr("width", "100%")
         .attr("height", "100%")
         .attr("fill", "#bcd1f1");
    loadGeo(svgEl);

};

function getWaypointColor(d) {
    // planes on the ground are green
    // those in the air are greener if in low altitude, closer to red if high altitude
    // if no altitude is given: purple
    if (d.ground) {
        return "green";
    }
    return d.alt ? d3.interpolateRdYlGn(1 - Math.min(d.alt/10000, 1)) : "purple";
};

function drawFlights() {
    let planes = d3.select("g#planes")
                    .selectAll("image")
                    .data(ctx.currentFlights, (d) => (d.id));

    planes.transition()
        .duration(ctx.TRANSITION_DURATION)
        .attr("transform", (d) => (getPlaneTransform(d)));

    planes.enter()
        .append("image")
        .attr("transform", (d) => (getPlaneTransform(d)))
        .attr("width", 8)
        .attr("height", 8)
        .attr("xlink:href", "plane_icon.png")
        .on("mouseover", function(event,d){displayCallsign(d.callsign);})
        .on("click", function(event,d){handleClickFlight(event, d);});
    
    planes.exit()
        .remove();
}

function drawWaypoints() {
    let waypoints = d3.select("g#waypoints")
        .selectAll("circle")
        .data(ctx.curPath);

    waypoints.attr("transform", (d) => (getPlaneTransform(d)))
        .attr("r", 2)
        .attr("fill", (d) => getWaypointColor(d));

    waypoints.enter()
        .append("circle")
        .attr("transform", (d) => (getPlaneTransform(d)))
        .attr("fill", (d) => getWaypointColor(d))
        .attr("r", 2);

    waypoints.exit()
        .remove();
}

function handleClickFlight(event, d) {
    ctx.curPath = [];
    d3.json(`https://opensky-network.org/api/tracks/all?icao24=${d.id}&time=0`).then(function(data){
        path = data.path;
        for (let i=0; i<path.length; i++) {
            point = path[i];
            ctx.curPath.push({lat: point[1], lon: point[2], alt: point[3], ground: point[5], bearing: point[4]});
        }
        drawWaypoints();
    })
}

function displayCallsign(callsign) {
    let info = d3.select("div#info");
    info.text(callsign ? callsign : "No callsign available for this flight.");
}

function loadFlights(){
    if (SRC == ctx.SRC_OS){
        loadPlanesFromOpenSky();
    }
    else {
        loadPlanesFromLocalDump(`opensky_20221130T13${LOCAL_DUMP_TIME_INDICES[0]}.json`);
    }
    startPlaneUpdater();
}

function loadPlanesFromLocalDump(dumpPath){
    console.log(`Querying local OpenSky dump ${dumpPath}...`);
    d3.json(dumpPath).then(function(data){
        restructureData(data);
        drawFlights();
        drawWaypoints();
    }).catch(function(error){console.log(error)});
};

function loadPlanesFromOpenSky(){
    console.log("Querying OpenSky...");
    // d3.json(`https://opensky-network.org/api/states/all?lamin=${ctx.LA_MIN}&lomin=${ctx.LO_MIN}&lamax=${ctx.LA_MAX}&lomax=${ctx.LO_MAX}`).then(function(data){
    d3.json("https://opensky-network.org/api/states/all").then(function(data){
        restructureData(data);
        drawFlights();
    }).catch(function(error){console.log(error)});
};

function restructureData(flights){
    ctx.currentFlights = [];
    for (let i = 0; i < flights.states.length; i ++)
    {
        flight = flights.states[i];
        flightEl = {id: flight[0], 
                    callsign: flight[1], 
                    lon: flight[5], 
                    lat: flight[6], 
                    bearing: flight[10], 
                    alt: flight[13]}
        if (flightEl.lon && flightEl.lat){
            ctx.currentFlights.push(flightEl);
        }
    }
}

function toggleUpdate(){
    // feel free to rewrite the 'if' test
    // this is just dummy code to make the interface
    // behave properly
    if (d3.select("#updateBt").attr("value") == "On"){
        d3.select("#updateBt").attr("value", "Off");
        clearInterval(ctx.planeUpdater);
    }
    else {
        d3.select("#updateBt").attr("value", "On");
        startPlaneUpdater();
    }
};

function startPlaneUpdater(){
    ctx.planeUpdater = setInterval(
        function(){
            if (SRC == ctx.SRC_OS){
                loadPlanesFromOpenSky();
            }
            else {
                loadPlanesFromLocalDump(`opensky_20221130T13${LOCAL_DUMP_TIME_INDICES[LOCAL_DUMP_TIME_INC]}.json`);
                if (LOCAL_DUMP_TIME_INC == LOCAL_DUMP_TIME_INDICES.length-1){
                    LOCAL_DUMP_TIME_INC = 0;
                }
                else {
                    LOCAL_DUMP_TIME_INC++;
                }

            }
        },
        ctx.DURATION_BETWEEN_UPDATES);
};

/** data fetching and transforming */
function loadGeo(svgEl){
    let promises = [d3.json("geojson/paris_iris.json"),
        d3.json("geojson/plan-de-voirie-voies-deau.geojson"),
        d3.json("geojson/espaces_verts.geojson"),
        d3.json("geojson/plan-de-voirie-chaussees.geojson"),
        d3.csv("data/paris-iris-2020-1-OnlyWeekends-MonthlyAggregate.csv")
    ];
    Promise.all(promises).then(function(data){
        drawMap(data[0], data[1], data[2], data[3], svgEl);
        ctx.distances = data[4].filter( d => d.month==1);
        // loadFlights();
    }).catch(function(error){console.log(error)});
};