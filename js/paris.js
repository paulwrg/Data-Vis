let ctx = {
    w: 800,
    h: 400,
    map_origin_lat: 2.3506,
    map_origin_lon: 48.8527,
    TRANSITION_DURATION: 1000,
    scale: 1,
    first: true,
    WEWD: "WE",
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
            })
            .on("mouseout", function(event,d) {
                thisNode = d3.select(this);
                tree.hover.selectAll("path")
                    .remove();
            })
            .on("dblclick",function(event, d){
                thisNode = d3.select(this);
                newOrigin(d3.select(this), d);
            })
            .on("click", function(event, d) {
                thisNode = d3.select(this);
                if (ctx.first) {
                    ctx.first = false;             
                    // Make green areas disappear as they would pollute the visual
                    tree.green.selectAll("path.green")
                        .style("opacity", 0);
                    newOrigin(d3.select(this), d);

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
    tree.selected.node().appendChild(thisNode.node().cloneNode());
    ctx.selected = d.properties.MOVEMENT_ID;
    ctx.filteredWE = ctx.distancesWE.filter(d => d.sourceid == ctx.selected);
    ctx.filteredWD = ctx.distancesWD.filter(d => d.sourceid == ctx.selected);
    tree.zones.selectAll("path.zone")

    // Color the zones in the map according to the time it takes to get there from selected point
    .style("fill", function(d) {
        dist = distanceUber(d);
        return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
    });

    tree.selected.node().appendChild(thisNode.node().cloneNode());
    tree.selected.selectAll("path")
        .attr("id", "selected_path")
        .style("stroke", "red")
        .style("fill", "none")
        .style("stroke-width", 5*ctx.scale)
        .attr("pointer-events", "none");

    ctx.src = getBoundingBoxCenter(d3.select("#selected_path"));
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
                dist = distanceUber(d);
                return dist ? d3.scaleSequentialQuantile(d3.interpolateRdYlGn).domain([-3600, -2700, -1800, -1200, -1200, -600, -300])(-dist): "black";
            });
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
        console.log(json)
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