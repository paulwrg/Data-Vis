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
    curPath: []
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

function drawMap(countries, svgEl){
    ctx.mapG = svgEl.append("g")
                    .attr("id", "map");
    // bind and draw geographical features to <path> elements
    let path4proj = d3.geoPath()
                 .projection(PROJECTIONS.ER);
    let countryG = ctx.mapG.append("g").attr("id", "zones");
    let overlay = ctx.mapG.append("g").attr("id", "overlay");
    let selected = overlay.append("g").attr("id", "selected");
    let hover = overlay.append("g").attr("id", "hover");
    countryG.selectAll("path.country")
            .data(countries.features)
            .enter()
            .append("path")
            .attr("d", path4proj)
            .attr("class", "zone")
            .style("fill", "grey")
            .style("stroke", "none")
            .style("stroke-width", "0.5")
            .on("mouseover", function(d) {
                thisNode = d3.select(this);
                hover.selectAll("path").remove();
                hover.node().appendChild(thisNode.node().cloneNode());
                hover.selectAll("path").style("stroke", "blue").style("fill", "none").style("stroke-width", "0.2");
            })
            .on("mouseout", function(d) {d3.select(this).style("fill", "grey").style("stroke", "none");})
            .on("click", function(d) {
                thisNode = d3.select(this);
                selected.selectAll("path").remove();
                selected.node().appendChild(thisNode.node().cloneNode());
                selected.selectAll("path").style("stroke", "black").style("fill", "none").style("stroke-width", "0.5");
                
            });
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

function getPlaneTransform(d){
    let xy = PROJECTIONS.ER([d.lon, d.lat]);
    let sc = 4*ctx.scale;
    let x = xy[0] - sc;
    let y = xy[1] - sc;
    if (d.bearing != null && d.bearing != 0){
        let t = `translate(${x},${y}) rotate(${d.bearing} ${sc} ${sc})`;
        return (ctx.scale == 1) ? t : t + ` scale(${ctx.scale})`;
    }
    else {
        let t = `translate(${x},${y})`;
        return (ctx.scale == 1) ? t : t + ` scale(${ctx.scale})`;
    }
};

function createViz(){
    d3.select("body")
      .on("keydown", (event,d) => (handleKeyEvent(event)));
    let svgEl = d3.select("#main").append("svg");
    svgEl.attr("width", ctx.w);
    svgEl.attr("height", ctx.h);
    svgEl.append("rect")
         .attr("x", 0)
         .attr("y", 0)
         .attr("width", "100%")
         .attr("height", "100%")
         .attr("fill", "#bcd1f1");
    loadGeo(svgEl);
};

/* data fetching and transforming */
function loadGeo(svgEl){
    let promises = [d3.json("paris_iris.json")];
    Promise.all(promises).then(function(data){
        drawMap(data[0], svgEl);
        // loadFlights();
    }).catch(function(error){console.log(error)});
};

function getWaypointColor(d) {
    // planes on the ground are green
    // those in the air are greener if in low altitude, closer to red if high altitude
    // if no altitude is given: purple
    if (d.ground) {
        return "green";
    }
    return d.alt ? d3.interpolateRdYlGn(1 - Math.min(d.alt/10000, 1)) : "purple";
}

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
