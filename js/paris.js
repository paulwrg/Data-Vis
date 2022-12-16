const ctx = {
    w: 800,
    h: 400,
    map_origin_lat: 2.3506,
    map_origin_lon: 48.8527,
    TRANSITION_DURATION: 1000,
    scale: 1,
    first: true,
    WEWD: "WE",
};

const PROJECTIONS = {
    ER: d3.geoConicConformal()
        .parallels([44,49])
        .center([ctx.map_origin_lat,ctx.map_origin_lon])
        .scale(3200000)
        .translate([ctx.w/2,ctx.h/2]),
};

const path4proj = d3.geoPath().projection(PROJECTIONS.ER);

function distance(d){
    if (d.properties.MOVEMENT_ID == ctx.selected) return -1;
    switch (ctx.WEWD){
        case "WE":
            for (let i = 0; i < ctx.filteredWE.length; i++) {
                if (ctx.filteredWE[i].dstid == d.properties.MOVEMENT_ID) {
                    // console.log(ctx.filteredWE[i].mean_travel_time)
                    return ctx.filteredWE[i].mean_travel_time;
                }
              }
        case "WD":
            for (let i = 0; i < ctx.filteredWD.length; i++) {
                if (ctx.filteredWD[i].dstid == d.properties.MOVEMENT_ID) {
                    // console.log(ctx.filteredWE[i].mean_travel_time)
                    return ctx.filteredWD[i].mean_travel_time;
                }
              }
    }
}

function getBoundingBoxCenter(selection) {
    var element = selection.node();
    var bbox = element.getBBox();
    return PROJECTIONS.ER.invert([bbox.x + bbox.width/2, bbox.y + bbox.height/2]);
}

function drawMap(zonesData, waterData, greenData, roadData, svgEl){
    ctx.mapG = svgEl.append("g")
                    .attr("id", "map");

    // bind and draw geographical features to <path> elements
    let path4proj = d3.geoPath()
                 .projection(PROJECTIONS.ER);

                
    //DOM Tree
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
            .on("dblclick",function(event, d){
                thisNode = d3.select(this);
                selected.selectAll("path").remove();
                selected.node().appendChild(thisNode.node().cloneNode());
                ctx.selected = d.properties.MOVEMENT_ID;
                ctx.filteredWE = ctx.distancesWE.filter(d => d.sourceid == ctx.selected);
                ctx.filteredWD = ctx.distancesWD.filter(d => d.sourceid == ctx.selected);
                zones.selectAll("path.zone")
                .style("fill", function(d) {
                    dist = distance(d);
                    return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
                });
                selected.node().appendChild(thisNode.node().cloneNode());
                selected.selectAll("path")
                    .attr("id", "selected_path")
                    .style("stroke", "red")
                    .style("fill", "none")
                    .style("stroke-width", 5*ctx.scale)
                    .attr("pointer-events", "none");

                console.log(getBoundingBoxCenter(d3.select("#selected_path")));
            })
            .on("click", function(event, d) {
                thisNode = d3.select(this);
                if (ctx.first) {
                    selected.node().appendChild(thisNode.node().cloneNode());
                    ctx.first = false;
                    
                    ctx.selected = d.properties.MOVEMENT_ID;
                    ctx.filteredWE = ctx.distancesWE.filter(d => d.sourceid == ctx.selected);
                    ctx.filteredWD = ctx.distancesWD.filter(d => d.sourceid == ctx.selected);

                    zones.selectAll("path.zone")
                    .style("fill", function(d) {
                        dist = distance(d);
                        return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
                    });
                    green.selectAll("path.green")
                        .style("opacity", 0);
                }
                else {
                    selected.select("path:last-child").remove();
                    ctx.target = d.properties.MOVEMENT_ID;
                }
                selected.node().appendChild(thisNode.node().cloneNode());
                selected.selectAll("path")
                    .style("stroke", "red")
                    .style("fill", "none")
                    .style("stroke-width", 5*ctx.scale)
                    .attr("pointer-events", "none");
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
    
    // pan & zoom
    function zoomed(event, d) {
      ctx.mapG.attr("transform", event.transform);
      let scale = ctx.mapG.attr("transform");
      scale = scale.substring(scale.indexOf('scale(')+6);
      scale = parseFloat(scale.substring(0, scale.indexOf(')')));
      ctx.scale = 1 / scale;
      selected.selectAll("path").style("stroke-width", 5*ctx.scale);
      if (ctx.scale != 1){
          d3.selectAll("image")
            .attr("transform", (d) => (getPlaneTransform(d)));
          d3.selectAll("circle")
            .attr("transform", (d) => (getPlaneTransform(d)));
      }
    }
    let zoom = d3.zoom()
        .scaleExtent([0.03, 3])
        .on("zoom", zoomed);
    svgEl.call(zoom)
    svgEl.on("dblclick.zoom", null);
};

function toggleWEWD() {
    if (d3.select("#WEWDbt").attr("value") == "WE"){
        d3.select("#WEWDbt").attr("value", "WD");
        ctx.WEWD = "WD";     
    }
    else {
        d3.select("#WEWDbt").attr("value", "WE");
        ctx.WEWD = "WE";
    }
    d3.select("#zones").selectAll("path.zone")
            .style("fill", function(d) {
                dist = distance(d);
                return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
            });
}
function createViz(){
    // d3.select("body")
    //   .on("keydown", (event,d) => (handleKeyEvent(event)));
    let svgEl = d3.select("#main").append("svg");
    svgEl.attr("width", "100%");
    svgEl.attr("height", "100vh");
    svgEl.append("rect")
         .attr("x", 0)
         .attr("y", 0)
         .attr("width", "100%")
         .attr("height", "100%")
         .attr("fill", "black");
    loadGeo(svgEl);

};


// function toggleUpdate(){
//     // feel free to rewrite the 'if' test
//     // this is just dummy code to make the interface
//     // behave properly
//     if (d3.select("#updateBt").attr("value") == "On"){
//         d3.select("#updateBt").attr("value", "Off");
//         clearInterval(ctx.planeUpdater);
//     }
//     else {
//         d3.select("#updateBt").attr("value", "On");
//         startPlaneUpdater();
//     }
// };

/** data fetching and transforming */
function loadGeo(svgEl){
    let promises = [d3.json("geojson/paris_iris.json"),
        d3.json("geojson/plan-de-voirie-voies-deau.geojson"),
        d3.json("geojson/espaces_verts.geojson"),
        d3.json("geojson/plan-de-voirie-chaussees.geojson"),
        d3.csv("data/paris-iris-2020-1-OnlyWeekends-MonthlyAggregate.csv"),
        d3.csv("data/paris-iris-2020-1-OnlyWeekdays-MonthlyAggregate.csv")
    ];
    Promise.all(promises).then(function(data){
        drawMap(data[0], data[1], data[2], data[3], svgEl);
        ctx.distancesWE = data[4].filter( d => d.month==1);
        ctx.distancesWD = data[5].filter( d => d.month==1);
        // loadFlights();
        svgEl.select("rect")
            .style("fill", "white");
    }).catch(function(error){console.log(error)});
};