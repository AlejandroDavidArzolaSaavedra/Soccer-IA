const cleanName = name => {
    if (!name) return ''; 
    return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const goalkeeperStats = {};
const tournamentStats = {};

const fileSets = {
    "2023": [
        "../json/2023_2024/top_goal_keeper/1_split_kings.csv",
        "../json/2023_2024/top_goal_keeper/2_split_kings.csv",
        "../json/2023_2024/top_goal_keeper/3_split_kings.csv",
        "../json/2023_2024/top_goal_keeper/kings_cup.csv",
        "../json/2023_2024/top_goal_keeper/kingdom_cup.csv"
    ],
    "2024": [
        "../json/2024_2025/top_goal_keeper/4_split_kings.csv",
        "../json/2024_2025/top_goal_keeper/5_split_kings.csv"
    ]
};

fileSets["combined"] = [...fileSets["2023"], ...fileSets["2024"]];
fileSets["splits-only"] = fileSets["2023"].slice(0, 2).concat(fileSets["2024"]);

function processInChunks(data, chunkSize, callback) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize));
    }
    
    let processed = 0;
    chunks.forEach((chunk, index) => {
        setTimeout(() => {
            callback(chunk);
            processed++;
            const progress = (processed / chunks.length) * 100;
            document.getElementById('progressBar').style.width = `${progress}%`;
        }, index * 50);
        });
}

function processData(file, data) {
    return new Promise((resolve) => {
        const isSplit = file.includes("split");
        const isCup = file.includes("kings_cup") || file.includes("kingdom_cup");
        const tournamentName = file.split('/').pop().replace('.csv', '').replace(/_/g, ' ');

        if (!tournamentStats[tournamentName]) {
            tournamentStats[tournamentName] = {
                totalSaves: 0,
                totalGoalsConceded: 0,
                totalPenaltiesSaved: 0,
                totalPSOSaved: 0,
                goalkeepers: new Set(),
                teams: new Set()
            };
    }

    const localGoalkeeperStats = {};

    processInChunks(data, 100, (chunk) => {
        chunk.forEach(row => {
            const name = cleanName(row["Name"] || row["Nombre"]), 
                    team = row["Team"] || row["Equipo"];
            if (!name || !team) return;

            let pm, sav, gc, penR, psoR;
            
            if (isSplit) {
                pm = parseInt(row["PM"]) || 0;
                sav = parseInt(row["Sav."]) || 0;
                gc = parseInt(row["GC"]) || 0;
                penR = parseInt(row["Pen.R"]) || 0;
                psoR = parseInt(row["PSO.R"]) || 0;
            } else if (isCup) {
                pm = parseInt(row["Pl"]) || 0;
                gc = parseInt(row["G.En"]) || 0;
                const ratio = parseFloat(row["Ratio"]) || 2.0;
                sav = Math.round(gc * ratio); 
                penR = 0;
                psoR = 0;
            }

            tournamentStats[tournamentName].totalSaves += sav;
            tournamentStats[tournamentName].totalGoalsConceded += gc;
            tournamentStats[tournamentName].totalPenaltiesSaved += penR;
            tournamentStats[tournamentName].totalPSOSaved += psoR;
            tournamentStats[tournamentName].goalkeepers.add(name);
            tournamentStats[tournamentName].teams.add(team);

            if (!localGoalkeeperStats[name]) {
                localGoalkeeperStats[name] = {
                name: (row["Name"] || row["Nombre"]).trim(),
                teams: new Set(),
                pm: 0,
                sav: 0,
                gc: 0,
                penR: 0,
                psoR: 0,
                timeline: [],
                isEstimated: isCup
                };
            }

            localGoalkeeperStats[name].teams.add(team);
            localGoalkeeperStats[name].pm += pm;
            localGoalkeeperStats[name].sav += sav;
            localGoalkeeperStats[name].gc += gc;
            localGoalkeeperStats[name].penR += penR;
            localGoalkeeperStats[name].psoR += psoR;
            localGoalkeeperStats[name].timeline.push({
                torneo: tournamentName,
                pm: pm,
                sav: sav,
                gc: gc,
                penR: penR,
                psoR: psoR,
                isEstimated: isCup
            });
        });
        resolve(Object.values(localGoalkeeperStats));
    });
});
}

function explainGoalkeeper(gk) {
    const savePercentage = (gk.sav / (gk.sav + gk.gc)) * 100;
    const savesPerMatch = (gk.sav / gk.pm).toFixed(1);
    const goalsConcededPerMatch = (gk.gc / gk.pm).toFixed(1);

    let html = `<div style="max-width: 500px;">`;
    html += `<strong>${gk.name}</strong>`;
    if (gk.isEstimated) {
        html += ` <span style="color: #EF4444; font-size: 0.8em;">(Datos estimados para copas)</span>`;
    }
    html += `<br>`;
    html += `<strong>Equipos:</strong> ${Array.from(gk.teams).join(", ")}<br>`;
    html += `<strong>Partidos jugados:</strong> ${gk.pm}<br>`;
    html += `<strong>Paradas:</strong> ${gk.sav} (${savePercentage.toFixed(1)}% efectividad)<br>`;
    html += `<strong>Goles encajados:</strong> ${gk.gc} (${goalsConcededPerMatch} por partido)<br>`;

    if (!gk.isEstimated) {
        html += `<strong>Penaltis parados:</strong> ${gk.penR}<br>`;
        html += `<strong>PSO parados:</strong> ${gk.psoR}<br>`;
    }

    html += `<strong>Paradas por partido:</strong> ${savesPerMatch}<br><br>`;

    if (gk.timeline.length > 1) {
        html += `<u>Torneos:</u><br>`;
        gk.timeline.forEach(t => {
            html += `• ${t.torneo}: ${t.sav} paradas, ${t.gc} goles encajados`;
            if (t.isEstimated) html += ` (estimado)`;
            html += `<br>`;
        });
    }

    html += `</div>`;
    return html;
}

function drawCorrelationCharts(goalkeepers) {
    const scatterDiv = document.createElement("div");
    scatterDiv.className = "bg-white rounded shadow mb-4 col-span-2";
    scatterDiv.style.width = "100%";
    scatterDiv.style.maxWidth = "1200px";
    scatterDiv.style.margin = "0 auto";
    scatterDiv.style.display = "grid";
    scatterDiv.style.justifyItems = "center";
    document.getElementById("dashboard").appendChild(scatterDiv);

    const chartDiv = document.createElement("div");
    chartDiv.style.width = "calc(10rem + 45vw)";
    chartDiv.style.height = "50vh";
    scatterDiv.appendChild(chartDiv);

    const trace = {
        x: goalkeepers.map(gk => gk.sav),
        y: goalkeepers.map(gk => gk.gc),
        mode: 'markers',
        type: 'scatter',
        text: goalkeepers.map(gk => gk.name),
        marker: { size: 8 }
    };

    Plotly.newPlot(chartDiv, [trace], {
        title: 'Correlación entre Paradas y Goles Encajados',
        xaxis: { title: 'Paradas (Sav)' },
        yaxis: { title: 'Goles Encajados (GC)' },
        margin: { t: 50 }
    });

    const description = document.createElement("p");
    description.className = "text-lg text-gray-700 mt-4 p-4";
    description.innerText = "Este gráfico muestra la relación entre las paradas realizadas y los goles encajados por cada portero. Una correlación negativa sugeriría que los porteros con más paradas tienden a encajar menos goles.";
    scatterDiv.appendChild(description);
}

async function runAdvancedML(goalkeepers) {
    const tfDiv = document.createElement("div");
    tfDiv.className = "bg-white rounded shadow p-4 col-span-2";
    tfDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Predicción de Rendimiento para Porteros</h3>';
    document.getElementById("dashboard").appendChild(tfDiv);

    try {
    await tf.ready();
    const filteredGKs = goalkeepers.filter(gk => gk.pm > 0);
    const features = filteredGKs.map(gk => [
        gk.sav / 100,
        gk.gc / 50,
        gk.penR / 10,
        gk.psoR / 5,
        gk.pm / 30
    ]);
    
    const labels = filteredGKs.map(gk => [
        (gk.sav * 0.8 - gk.gc * 0.5 + gk.penR * 0.3 + gk.psoR * 0.4) / 50
    ]);
    
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);
    
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [5] }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError'
    });

    await model.fit(xs, ys, {
        epochs: 30,
        batchSize: 8,
        shuffle: true,
    });
    
    const topGKs = [...filteredGKs].sort((a, b) => b.sav - a.sav).slice(0, 3);
    topGKs.forEach(gk => {
        const input = tf.tensor2d([[
        gk.sav / 100,
        gk.gc / 50,
        gk.penR / 10,
        gk.psoR / 5,
        gk.pm / 30
        ]]);
        
        const prediction = model.predict(input).dataSync()[0] * 50;
        const predictionElement = document.createElement("div");
        predictionElement.className = "mb-2 p-2 bg-blue-50 rounded";
        
        let interpretacion = "";
        if (prediction >= 80) {
            interpretacion = "🔥 Portero excepcional";
        } else if (prediction >= 60) {
            interpretacion = "💪 Portero destacado";
        } else if (prediction >= 40) {
            interpretacion = "⚙️ Portero promedio alto";
        } else if (prediction >= 20) {
            interpretacion = "⚠️ Por debajo de lo esperado";
        } else {
            interpretacion = "❌ Rendimiento muy bajo";
        }

        predictionElement.innerHTML = `
            <p><strong>${gk.name}</strong>: Predicción de rendimiento: ${prediction.toFixed(1)} puntos</p>
            <p class="text-sm text-gray-700">${interpretacion}</p>
        `;
        tfDiv.appendChild(predictionElement);
    });
    } catch (error) {
        console.error("Error en TensorFlow:", error);
        tfDiv.innerHTML += '<p class="text-red-500">Error al procesar el modelo predictivo</p>';
    }
    
    let divElement = document.createElement("div");
    divElement.innerHTML = '<p class="text-sm text-gray-600 mb-4">Estos resultados son aproximados: la inteligencia artificial puede variar ligeramente en cada carga, pero ofrece predicciones muy similares. Su objetivo es ayudar a estimar el rendimiento de cada portero de forma objetiva. Cada rango indica la importancia y la calidad del portero.<\p>';
    tfDiv.appendChild(divElement);
    
    let divElementText = document.createElement("div");
    divElementText.innerHTML = `
        <p class="text-sm text-gray-600 mb-4">
            Para predecir el rendimiento de los porteros, se ajustan varias estadísticas clave a la misma escala de la siguiente manera:
        </p>
        <ul class="text-sm text-gray-600 mb-4">
            <li><strong>Paradas (sav):</strong> Se dividen entre 100 para normalizar su impacto.</li>
            <li><strong>Goles encajados (gc):</strong> Se dividen entre 50 (con peso negativo).</li>
            <li><strong>Penaltis parados (penR):</strong> Se dividen entre 10.</li>
            <li><strong>PSO parados (psoR):</strong> Se dividen entre 5.</li>
            <li><strong>Partidos jugados (pm):</strong> Se dividen entre 30 para reflejar experiencia.</li>
        </ul>
    `;
    tfDiv.appendChild(divElementText);
}

function clusterPlayers(goalkeepers) {
    const clusterDiv = document.createElement("div");
    clusterDiv.className = "bg-white rounded shadow p-4 col-span-2";
    clusterDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Agrupación de Porteros por Estilo</h3>';
    document.getElementById("dashboard").appendChild(clusterDiv);

    try {
    const data = goalkeepers
        .filter(gk => gk.pm > 0)
        .map(gk => ({
        name: gk.name,
        features: [gk.sav, gk.gc * -1, gk.penR * 2, gk.psoR * 2],
        total: gk.sav - gk.gc + gk.penR * 2 + gk.psoR * 2
        }));

    const maxValues = [0, 0, 0, 0];
    data.forEach(d => {
        d.features.forEach((f, i) => {
        if (Math.abs(f) > maxValues[i]) maxValues[i] = Math.abs(f);
        });
    });

    const normalizedData = data.map(d => ({
        ...d,
        features: d.features.map((f, i) => f / (maxValues[i] || 1))
    }));

    const k = 3;
    const centroids = [];
    for (let i = 0; i < k; i++) {
        centroids.push(normalizedData[Math.floor(Math.random() * normalizedData.length)].features);
    }

    const clusteredData = normalizedData.map(d => {
        let minDist = Infinity;
        let cluster = 0;

        centroids.forEach((c, i) => {
        const dist = Math.sqrt(
            Math.pow(d.features[0] - c[0], 2) +
            Math.pow(d.features[1] - c[1], 2) +
            Math.pow(d.features[2] - c[2], 2) +
            Math.pow(d.features[3] - c[3], 2)
        );
        if (dist < minDist) {
            minDist = dist;
            cluster = i;
        }
        });

        return { ...d, cluster };
    });

    const clusterGroups = {};
    clusteredData.forEach(d => {
        if (!clusterGroups[d.cluster]) {
        clusterGroups[d.cluster] = [];
        }
        clusterGroups[d.cluster].push(d);
    });

    Object.entries(clusterGroups).forEach(([cluster, gks]) => {
        const clusterElement = document.createElement("div");
        clusterElement.className = "mb-4 p-3 bg-gray-50 rounded";
        clusterElement.innerHTML = `<h4 class="font-semibold mb-2">Grupo ${parseInt(cluster) + 1} (${gks.length} porteros)</h4>`;

        const sortedGKs = [...gks].sort((a, b) => b.total - a.total);
        const topGKs = sortedGKs.slice(0, 5);
        const restGKs = sortedGKs.slice(5);

        topGKs.forEach(gk => {
        const gkElement = document.createElement("div");
        gkElement.className = "text-sm mb-1";
        gkElement.textContent = `${gk.name}: ${data.find(d => d.name === gk.name).total.toFixed(1)} puntos`;
        clusterElement.appendChild(gkElement);
        });

        if (restGKs.length > 0) {
        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = "Ver más porteros";
        toggleBtn.className = "text-blue-500 text-xs mt-2 hover:underline";
        toggleBtn.style.cursor = "pointer";

        const restContainer = document.createElement("div");
        restContainer.style.display = "none";

        restGKs.forEach(gk => {
            const gkElement = document.createElement("div");
            gkElement.className = "text-sm mb-1";
            gkElement.textContent = `${gk.name}: ${data.find(d => d.name === gk.name).total.toFixed(1)} puntos`;
            restContainer.appendChild(gkElement);
        });

        toggleBtn.addEventListener("click", () => {
            const visible = restContainer.style.display === "block";
            restContainer.style.display = visible ? "none" : "block";
            toggleBtn.textContent = visible ? "Ver más porteros" : "Ocultar porteros";
        });

        clusterElement.appendChild(toggleBtn);
        clusterElement.appendChild(restContainer);
        }

        const avgFeatures = [0, 0, 0, 0];
        gks.forEach(gk => {
            gk.features.forEach((f, i) => {
                avgFeatures[i] += f * (maxValues[i] || 1);
        });
        });

        avgFeatures.forEach((f, i) => avgFeatures[i] = (f / gks.length).toFixed(1));

        const descElement = document.createElement("div");
        descElement.className = "text-xs mt-2 p-2 bg-white rounded";
        descElement.innerHTML = `
            <p><strong>Perfil promedio:</strong></p>
            <p>Paradas: ${avgFeatures[0]}</p>
            <p>Goles encajados: ${-avgFeatures[1]}</p>
            <p>Penaltis parados: ${(avgFeatures[2] / 2).toFixed(1)}</p>
            <p>PSO parados: ${(avgFeatures[3] / 2).toFixed(1)}</p>
        `;
        clusterElement.appendChild(descElement);

        clusterDiv.appendChild(clusterElement);
    });
    } catch (error) {
    console.error("Error en clustering:", error);
    clusterDiv.innerHTML += '<p class="text-red-500">Error al agrupar porteros</p>';
    }
}

function generateStorytelling(goalkeepers, tournaments) {
    const storyDiv = document.createElement("div");
    storyDiv.className = "bg-white rounded shadow p-4 col-span-2";
    storyDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Narrativa de los Porteros de la Kings League</h3>';
    document.getElementById("dashboard").appendChild(storyDiv);

    const topSavers = [...goalkeepers].sort((a, b) => b.sav - a.sav).slice(0, 3);

    const bestSavePercentage = [...goalkeepers]
        .filter(gk => gk.pm >= 5)
        .sort((a, b) => (b.sav / (b.sav + b.gc)) - (a.sav / (a.sav + a.gc)))[0];

    const topPenaltySaver = [...goalkeepers].sort((a, b) => b.penR - a.penR)[0];

    let story = `<div class="prose max-w-none">`;
    
    story += `<h4 class="font-semibold text-blue-800">Resumen de la Temporada</h4>`;
    story += `<p>En un emocionante torneo que contó con ${Object.keys(tournaments).length} competiciones distintas, `;
    story += `los porteros demostraron su calidad con un total de ${Object.values(tournaments).reduce((sum, t) => sum + t.totalSaves, 0)} paradas. `;
    story += `Se encajaron ${Object.values(tournaments).reduce((sum, t) => sum + t.totalGoalsConceded, 0)} goles en total.</p>`;
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">Los Porteros Estrella</h4>`;
    topSavers.forEach((gk, i) => {
    const savePercentage = ((gk.sav / (gk.sav + gk.gc)) * 100).toFixed(1);
    story += `<p>${i+1}. <strong>${gk.name}</strong> lidera la tabla con ${gk.sav} paradas (${savePercentage}% efectividad), `;
    story += `encajando ${gk.gc} goles en ${gk.pm} partidos. `;
    story += `Además, paró ${gk.penR} penaltis y ${gk.psoR} en PSO.</p>`;
    });
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">El Portero Más Efectivo</h4>`;
    story += `<p><strong>${bestSavePercentage.name}</strong> demostró ser el portero más efectivo, `;
    story += `con un ${(bestSavePercentage.sav / (bestSavePercentage.sav + bestSavePercentage.gc) * 100).toFixed(1)}% de paradas. `;
    story += `Un rendimiento destacado que lo convierte en un pilar fundamental para su equipo.</p>`;
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">Especialista en Penaltis</h4>`;
    story += `<p><strong>${topPenaltySaver.name}</strong> se consagró como el mejor parando penaltis, `;
    story += `con un total de ${topPenaltySaver.penR} detenidos. Una habilidad clave en momentos decisivos del juego.</p>`;
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">Estadísticas Destacadas</h4>`;
    story += `<ul class="list-disc pl-5">`;
    story += `<li>Total de porteros participantes: ${goalkeepers.length}</li>`;
    story += `<li>Equipos representados: ${new Set(Object.values(tournaments).flatMap(t => Array.from(t.teams))).size}</li>`;
    story += `<li>Penaltis parados en total: ${Object.values(tournaments).reduce((sum, t) => sum + t.totalPenaltiesSaved, 0)}</li>`;
    story += `<li>PSO parados en total: ${Object.values(tournaments).reduce((sum, t) => sum + t.totalPSOSaved, 0)}</li>`;
    story += `</ul>`;
    
    story += `</div>`;
    
    storyDiv.innerHTML += story;
}

let isLoading = false;
    
function loadYear(year) {
    document.getElementById("loading").classList.remove("hidden");
    document.getElementById("dashboard").innerHTML = '';

    if (isLoading) return;
    isLoading = true;

    for (const key in goalkeeperStats) delete goalkeeperStats[key];
    for (const key in tournamentStats) delete tournamentStats[key];

    const files = fileSets[year];

    if (files.length === 0) {
    document.getElementById("loading").classList.add("hidden");
    isLoading = false;
    return;
    }

    const promises = files.map(file =>
    new Promise((resolve, reject) => {
        Papa.parse(file, {
        download: true,
        header: true,
        complete: results => {
            processData(file, results.data).then(resolve).catch(reject);
        },
        error: err => reject(err)
        });
    })
    );

    Promise.all(promises).then(results => {
        const mergedGoalkeepers = {};

        results.flat().forEach(gk => {
            const name = gk.name;
            if (!mergedGoalkeepers[name]) {
            mergedGoalkeepers[name] = {
                ...gk,
                teams: new Set(gk.teams),
                timeline: [...gk.timeline]
            };
            } else {
            mergedGoalkeepers[name].pm += gk.pm;
            mergedGoalkeepers[name].sav += gk.sav;
            mergedGoalkeepers[name].gc += gk.gc;
            mergedGoalkeepers[name].penR += gk.penR;
            mergedGoalkeepers[name].psoR += gk.psoR;
            gk.teams.forEach(t => mergedGoalkeepers[name].teams.add(t));
            mergedGoalkeepers[name].timeline.push(...gk.timeline);
            }
        });

        const goalkeepersArray = Object.values(mergedGoalkeepers).map(gk => ({
            ...gk,
            team: Array.from(gk.teams).join(", ")
        }));

        drawBasicCharts(goalkeepersArray);
        drawCorrelationCharts(goalkeepersArray);
        runAdvancedML(goalkeepersArray);
        clusterPlayers(goalkeepersArray);
        generateStorytelling(goalkeepersArray, tournamentStats);

        document.getElementById("loading").classList.add("hidden");
        isLoading = false;
        }).catch(err => {
            console.error("Error procesando archivos:", err);
            document.getElementById("loading").classList.add("hidden");
            isLoading = false;
        });
    }

    function drawBasicCharts(goalkeepers) {
        const categories = [
        { key: 'sav', label: 'Paradas (Sav)', color: '#3B82F6' },
        { key: 'gc', label: 'Goles Encajados (GC)', color: '#EF4444' },
        { key: 'penR', label: 'Penaltis Parados (Pen.R)', color: '#10B981' },
        { key: 'psoR', label: 'PSO Parados (PSO.R)', color: '#8B5CF6' }
        ];

        categories.forEach(cat => {
        const top = [...goalkeepers].filter(gk => gk[cat.key] > 0).sort((a, b) => b[cat.key] - a[cat.key]).slice(0, 10);
        const chartDiv = document.createElement("div");
        chartDiv.className = "bg-white rounded shadow p-4";
        chartDiv.style.height = "400px";
        document.getElementById("dashboard").appendChild(chartDiv);
        
        const chart = echarts.init(chartDiv);
        chart.setOption({
            title: { text: `Top 10 - ${cat.label}`, left: 'center' },
            tooltip: {
            confine: true,
            formatter: params => {
                const gk = goalkeepers.find(g => g.name === params.name);
                return explainGoalkeeper(gk);
            }
            },
            xAxis: {
            type: 'category',
            data: top.map(gk => gk.name),
            axisLabel: {
                rotate: 30,
                interval: 0,
                formatter: function (value) {
                return value.length > 15 ? value.slice(0, 12) + '...' : value;
                },
                textStyle: {
                fontSize: 12,
                lineHeight: 16
                }
            }
            },
            yAxis: { type: 'value' },
            series: [{
            data: top.map(gk => gk[cat.key]),
            type: 'bar',
            itemStyle: { color: cat.color },
            emphasis: { itemStyle: { color: '#4CAF50' } }
            }],
            grid: {
            left: '10%',
            right: '10%',
            bottom: '25%' 
            }
        });
    });

    const effectivenessDiv = document.createElement("div");
    effectivenessDiv.className = "bg-white rounded shadow p-4";
    effectivenessDiv.style.height = "400px";
    document.getElementById("dashboard").appendChild(effectivenessDiv);
    
    const effectivenessData = goalkeepers
        .filter(gk => gk.pm >= 5)
        .map(gk => ({
            name: gk.name,
            value: (gk.sav / (gk.sav + gk.gc)) * 100,
            team: gk.team,
            saves: gk.sav,
            conceded: gk.gc
        }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
    
    const effectivenessChart = echarts.init(effectivenessDiv);
    effectivenessChart.setOption({
    title: { text: 'Top 10 - Porcentaje de Paradas', left: 'center' },
    tooltip: {
        formatter: params => {
        return `
            <div style="max-width: 300px;">
            <strong>${params.data.name}</strong><br>
            <strong>Equipo:</strong> ${params.data.team}<br>
            <strong>Paradas:</strong> ${params.data.saves}<br>
            <strong>Goles encajados:</strong> ${params.data.conceded}<br>
            <strong>Efectividad:</strong> ${params.data.value.toFixed(1)}%<br>
            </div>
        `;
        }
    },
    xAxis: {
        type: 'category',
        data: effectivenessData.map(gk => gk.name),
        axisLabel: { rotate: 30 }
    },
    yAxis: {
        type: 'value',
        axisLabel: {
        formatter: '{value}%'
        }
    },
    series: [{
        data: effectivenessData.map(gk => gk.value),
        type: 'bar',
        itemStyle: { color: '#10B981' }
    }]
    });

    const tableDiv = document.createElement("div");
    tableDiv.className = "bg-white rounded shadow p-4 lg:col-span-2 overflow-x-auto";
    document.getElementById("dashboard").appendChild(tableDiv);
    
    const tableHTML = `
    <h3 class="text-lg font-semibold mb-4 text-center">Estadísticas Completas de Porteros</h3>
    <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
        <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ranking</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipo</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PM</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sav.</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GC</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pen.R</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PSO.R</th>
        </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
        ${goalkeepers.sort((a, b) => b.sav - a.sav).map((gk, index) => `
            <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${index + 1}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.team}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.pm}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.sav}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.gc}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.penR}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${gk.psoR}</td>
            </tr>
        `).join('')}
        </tbody>
    </table>
    `;
    
    tableDiv.innerHTML = tableHTML;
}

document.addEventListener("DOMContentLoaded", function() {
    if (fileSets && fileSets['2023']) {
    loadYear('2023');
    } else {
    console.warn("fileSets['2023'] aún no está disponible.");
    }
});
