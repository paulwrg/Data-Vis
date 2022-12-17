let ctx = {
    w: 800,
    h: 400,
    map_origin_lat: 2.3506,
    map_origin_lon: 48.8527,
    TRANSITION_DURATION: 1000,
    scale: 1,
    first: true,
    WEWD: "WE",
    MEDIUM: "TAXI"
}
/**
 * times between src and target
 */
let results = {
}


/**
 * backgroundMap; 
 * zones; 
 * landmarks; 
 * water; 
 * green; 
 * roads; 
 * overlay; 
 * hover; 
 * selected; 
 */
let tree = {
}

const PROJECTIONS = {
    ER: d3.geoConicConformal()
        .parallels([44,49])
        .center([ctx.map_origin_lat,ctx.map_origin_lon])
        .scale(3200000)
        .translate([ctx.w/2,ctx.h/2]),
}

const path4proj = d3.geoPath().projection(PROJECTIONS.ER);

/** Returns the distance in kilometers between two points using spherical-Earth approximation. */
function haversineDistance(coords1, coords2) {
    function toRad(x) {
      return x * Math.PI / 180;
    }
  
    var lon1 = coords1[0];
    var lat1 = coords1[1];
  
    var lon2 = coords2[0];
    var lat2 = coords2[1];
  
    var R = 6371; // km
  
    var x1 = lat2 - lat1;
    var dLat = toRad(x1);
    var x2 = lon2 - lon1;
    var dLon = toRad(x2)
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
  
    return d;
}

/** Returns the mean travel time of an Uber ride from selected source to input zone. */
function distanceUber(d){
    if (d.properties.MOVEMENT_ID == ctx.selected) return -1;
    switch (ctx.WEWD){
        case "WE":
            for (let i = 0; i < ctx.filteredWE.length; i++) {
                if (ctx.filteredWE[i].dstid == d.properties.MOVEMENT_ID) {
                    return ctx.filteredWE[i].mean_travel_time;
                }
            }
            break;
        case "WD":
            for (let i = 0; i < ctx.filteredWD.length; i++) {
                if (ctx.filteredWD[i].dstid == d.properties.MOVEMENT_ID) {
                    return ctx.filteredWD[i].mean_travel_time;
                }
            }
            break;
    }
}

function differenceWEWDUber(d){
    foundWE = false;
    foundWD = false;
    if (d.properties.MOVEMENT_ID == ctx.selected) return 0;
    for (let i = 0; i < ctx.filteredWE.length; i++) {
        if (ctx.filteredWE[i].dstid == d.properties.MOVEMENT_ID) {
            we = ctx.filteredWE[i].mean_travel_time;
            foundWE = true;
            break;
        }
    }
    for (let i = 0; i < ctx.filteredWD.length; i++) {
        if (ctx.filteredWD[i].dstid == d.properties.MOVEMENT_ID) {
            wd = ctx.filteredWD[i].mean_travel_time;
            foundWD = true;
            break;
        }
    }
    if (foundWE && foundWD)
    {
        return wd - we;
    }
    return 10000;
}

// Converts time from seconds to hours-minutes-seconds format
function convertTime(totalInSeconds) {
    hours = Math.floor(totalInSeconds/3600);
    remainder = totalInSeconds - 3600 * hours;
    minutes = Math.floor(remainder/60);
    seconds = remainder - 60 * minutes;
    return `${hours} hours ${minutes} mitues and ${Math.floor(seconds)} seconds`;
}

/** Returns the geo coordinates of the center of the bounding box of any element selected using d3.select(...). */
function getBoundingBoxCenter(selection) {
    var element = selection.node();
    var bbox = element.getBBox();
    return PROJECTIONS.ER.invert([bbox.x + bbox.width/2, bbox.y + bbox.height/2]);
}

function drawMap(zonesData, waterData, greenData, roadData, svgEl){
    console.log(zonesData);
    ctx.mapG = svgEl.append("g")
                    .attr("id", "map");

    // bind and draw geographical features to <path> elements
    let path4proj = d3.geoPath()
                 .projection(PROJECTIONS.ER);

                
    //DOM Tree
    tree.backgroundMap = ctx.mapG.append("g").attr("id", "backgroundMap");
    tree.zones = tree.backgroundMap.append("g").attr("id", "zones");

    tree.landmarks = ctx.mapG.append("g").attr("id", "landmarks").attr("pointer-events", "none");
    tree.water = tree.landmarks.append("g").attr("id", "waterSpaces");
    tree.green = tree.landmarks.append("g").attr("id", "greenSpaces");
    tree.roads = tree.landmarks.append("g").attr("id", "roadSpaces");

    tree.overlay = ctx.mapG.append("g").attr("id", "overlay");
    tree.hover = tree.overlay.append("g").attr("id", "hover");
    tree.selected = tree.overlay.append("g").attr("id", "selected");

    tree.zones.selectAll("path.zone")
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
                tree.hover.selectAll("path")
                    .remove();
                tree.hover.node()
                    .appendChild(thisNode.node().cloneNode());
                tree.hover.selectAll("path")
                    .style("stroke", "blue")
                    .style("fill", "blue")
                    .style("opacity", 0.6)
                    .style("stroke-width", "0")
                    .attr("pointer-events", "none");
                if (ctx.selected) {
                    d3.select("#info").text(d.properties.DISPLAY_NAME)
                };
                console.log(distanceUber(d));
                console.log(differenceWEWDUber(d));
            })
            .on("mouseout", function(event,d) {
                tree.hover.selectAll("path")
                    .remove();
            })
            .on("dblclick",function(event, d){
                thisNode = d3.select(this);
                newOrigin(thisNode, d);
            })
            .on("click", function(event, d) {
                thisNode = d3.select(this);
                if (ctx.first) {
                    ctx.first = false;             
                    // Make green areas disappear as they would pollute the visual
                    tree.green.selectAll("path.green")
                        .style("opacity", 0);
                    newOrigin(thisNode, d);

                }
                else {
                    newTarget(thisNode, d);
                }
                tree.selected.selectAll("path.zone")
                    .style("stroke", "red")
                    .style("fill", "none")
                    .style("stroke-width", 5*ctx.scale)
                    .attr("pointer-events", "none");


            });


    tree.water.selectAll("path.water")
        .data(waterData.features)
        .enter()
        .append("path")
        .attr("d", path4proj)
        .attr("class", "water")
        .style("fill", "lightblue");

    tree.green.selectAll("path.green")
        .data(greenData.features)
        .enter()
        .append("path")
        .attr("d", path4proj)
        .attr("class", "green")
        .style("fill", "#daffb3");

    tree.roads.selectAll("path.road")
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
      tree.selected.selectAll("path").style("stroke-width", 5*ctx.scale);
      tree.overlay.select("#arrow").selectAll("line")
        .style("stroke-width", 5*ctx.scale)
        .style("stroke-dasharray", `${10*ctx.scale} , ${10*ctx.scale}`);
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
}

function newOrigin(thisNode, d) {
    tree.selected.selectAll("path").remove();
    tree.overlay.select("#arrow").remove();

    tree.selected.node().appendChild(thisNode.node().cloneNode());
    ctx.selected = d.properties.MOVEMENT_ID;
    ctx.filteredWE = ctx.distancesWE.filter(d => d.sourceid == ctx.selected);
    ctx.filteredWD = ctx.distancesWD.filter(d => d.sourceid == ctx.selected);

    tree.selected.node().appendChild(thisNode.node().cloneNode());
    tree.selected.selectAll("path")
        .attr("id", "selected_path")
        .style("stroke", "red")
        .style("fill", "none")
        .style("stroke-width", 5*ctx.scale)
        .attr("pointer-events", "none");

    ctx.src = getBoundingBoxCenter(d3.select("#selected_path"));

    // Color the zones in the map according to the time it takes to get there from selected point
    switch (ctx.MEDIUM) {
        case "METRO":
            drawMetro();
            break;
        case "TAXI-WEWD":
            drawTaxiWEWD();
            break;
        case "WALK":
            drawWalk();
            break;
        case "TAXI":
        default:
            drawTaxi();
            break;
    }
}

function newTarget(thisNode, d) {
    tree.selected.select("path:last-child").remove();
    tree.selected.node().appendChild(thisNode.node().cloneNode());

    ctx.target = d.properties.MOVEMENT_ID;

    results.walk = (3600/4) * haversineDistance(getBoundingBoxCenter(tree.selected.select("path:last-child")), ctx.src);
    results.uber = distanceUber(d);
    getMinJourney(thisNode).then(function(min) 
    {
        results.public = min;
        printRes();
    });

    drawArrow();
}

function drawArrow() {
    let trgt = getBoundingBoxCenter(tree.selected.select("path:last-child"));
    let xy1 = PROJECTIONS.ER([ctx.src[0], ctx.src[1]]);
    let xy2 = PROJECTIONS.ER([trgt[0], trgt[1]]);
    tree.overlay.select("#arrow").remove();
    arrow = tree.overlay.append("g").attr("id", "arrow")
    // arrow.append("marker")
    //     .attr("id", "triangle")
    //     .attr("viewBox", "0 0 10 10")
    //     .attr("refX", 0)
    //     .attr("refY", 5)
    //     .style("stroke", "red")
    //     .style("fill", "red")
    //     .attr("markerUnits", "strokeWidth")
    //     .attr("markerWidth", 4)
    //     .attr("markerHeight", 3)
    //     .attr("orient", "auto")
    //     .append("path")
    //     .attr("d", "M 0 0 L 10 5 L 0 10 z")
    arrow.append("line")
        .attr("x1", xy1[0] )
        .attr("y1", xy1[1] )
        .attr("x2", xy2[0] )
        .attr("y2", xy2[1] )
        .style("stroke", "white")
        .style("stroke-width", 5*ctx.scale)
        .style("stroke-dasharray", `${10*ctx.scale} , ${10*ctx.scale}`);
        // .attr("marker-end", "url(#triangle)");

    //     <marker id="triangle" viewBox="0 0 10 10" refX="0" refY="5" markerUnits="strokeWidth" markerWidth="4" markerHeight="3" orient="auto">
    //   <path d="M 0 0 L 10 5 L 0 10 z"/>
    // </marker>
	// <line x1="100" y1="50.5" x2="300" y2="50.5" marker-end="url(#triangle)" stroke="black" stroke-width="10"/>

}

function printRes() {
    d3.select("#temp")
        .text(
`
public : ${convertTime(results.public)} \n
walk : ${convertTime(results.walk)} \n
uber : ${convertTime(results.uber)} \n
`
            )
}

function toggleWEWD() {
    if (ctx.WEWD == "WE"){
        ctx.WEWD = "WD";
        d3.select("#wewd-slider")
            .transition()
            .duration(300)
            .style("left", "23px");
    }
    else {
        ctx.WEWD = "WE";
        d3.select("#wewd-slider")
            .transition()
            .duration(300)
            .style("left", "1px");
    }
    if (ctx.MEDIUM == "TAXI") {
        if (ctx.src)
        {
            drawTaxi();
        }
    }
}

function getMinJourney(thisNode) {
    box = getBoundingBoxCenter(thisNode);

    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', '3b036afe-0110-4202-b9ed-99718476c2e0');
    let min =  fetch(`https://api.navitia.io/v1/coverage/sandbox/journeys?from=${ctx.src[0]}%3B${ctx.src[1]}&to=${box[0]}%3B${box[1]}&`,
    {
        method: 'GET',
        headers: myHeaders,
    }).then(function(response) {return response.json();})
    .then(function(json) {
        // console.log(json)
        if (json.journeys)
        {
            var min = json.journeys[0].duration;
            for (i=1; i<json.journeys.length;i++){
                if (json.journeys[i].duration < min) {
                    min = json.journeys[i].duration;
                }
            }
            return min;
        }
    });
    return min;
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
}

function back2black() {
    tree.zones.select("#isochrone").remove();
    tree.zones.selectAll("path.zone")
        .style("fill", "black");
}

function toggleTaxi() {
    ctx.MEDIUM = "TAXI";
    d3.select("#medium-selection li text")
        .text("Uber ride: mean duration")
    d3.select("#black-label")
        .text("No data")
    
    back2black();
    console.log(ctx.src);
    if (ctx.src)
    {
        drawTaxi();
    }
}

function drawTaxi() {
    console.log("Draw taxi");
    tree.zones.selectAll("path.zone")
        .style("fill", function(d) {
            dist = distanceUber(d);
            return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
        });
}

function toggleTaxiWEWD() {
    ctx.MEDIUM = "TAXI-WEWD";
    d3.select("#medium-selection li text")
        .text("Uber week-ends vs week-days")
    d3.select("#black-label")
        .text("No data")
    
    back2black();
    if (ctx.src) {
        drawTaxiWEWD();
    }
}

function drawTaxiWEWD() {
    console.log("Draw taxi WEWD");
    tree.zones.selectAll("path.zone")
        .style("fill", function(d) {
            return differenceWEWDUber(d) ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-differenceWEWDUber(d)): "black";
            // dist = differenceWEWDUber(d);
            // return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
        });
}

function toggleMetro() {
    ctx.MEDIUM = "METRO";
    d3.select("#medium-selection li text")
        .text("Public transport: mean duration")
    d3.select("#black-label")
        .text("60+/No data")

    back2black();
    if (ctx.src) {
        drawMetro();
    }
}

function drawMetro() {
    console.log("Draw Metro");
    back2black();

    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    myHeaders.append('Authorization', '3b036afe-0110-4202-b9ed-99718476c2e0');
    let min =  fetch(`https://api.navitia.io/v1/coverage/sandbox/isochrones?from=${ctx.src[0]}%3B${ctx.src[1]}&boundary_duration%5B%5D=300&boundary_duration%5B%5D=600&boundary_duration%5B%5D=1200&boundary_duration%5B%5D=1800&boundary_duration%5B%5D=2700&boundary_duration%5B%5D=3600&`,
    // [-3600, -2700, -1800, -1200, -1200, -600, -300]
    {
        method: 'GET',
        headers: myHeaders,
    }).then(function(response) {return response.json();})
    .then(function(json) {
        console.log(json);
        for (i=0; i<json.isochrones.length; i++){
            json.isochrones[i]['geometry'] = json.isochrones[i].geojson;
            json.isochrones[i]['type'] = "Feature";
            json.isochrones[i]['i'] = i;
        }
        console.log(json);

        let color = ["rgb(0, 104, 55)","rgb(76, 176, 92)","rgb(182, 224, 118)","rgb(253, 190, 112)","rgb(233, 89, 58)","rgb(165, 0, 38)"];

        tree.zones.append("g").attr("id", "isochrone")
            .selectAll("path.isochrone")
            .data(json.isochrones)
            .enter()
            .append("path")
            .attr("d", path4proj)
            .attr("class", "isochrone")
            .attr("pointer-events", "none")
            .style("fill", data => color[data.i]);
    });
}

function toggleWalk() {
    ctx.MEDIUM = "WALK";
    d3.select("#medium-selection li text")
        .text("Walking: mean duration")
    d3.select("#black-label")
        .text("60+/No data")
    back2black();
    drawWalk();
}

function drawWalk() {
    console.log("Draw Walk");
    tree.zones.selectAll("path.zone")
        .style("fill", function(d) {
            dist = (3600/4) * haversineDistance(getBoundingBoxCenter(d3.select(this)), ctx.src);
            return dist<3600 ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
        });
}

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
        svgEl.select("rect")
            .style("fill", "white");
    }).catch(function(error){console.log(error)});
}