const cleanName = name => {
if (!name) return '';
return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const playerStats = {};
const tournamentStats = {};

const fileSets = {
    "2023": [
        "../json/2023_2024/cards/1_split_kings.csv",
        "../json/2023_2024/cards/2_split_kings.csv",
        "../json/2023_2024/cards/3_split_kings.csv",
        "../json/2023_2024/cards/kings_cup.csv"
    ],
    "2024": [
        "../json/2024_2025/cards/4_split_kings.csv",
        "../json/2024_2025/cards/5_split_kings.csv"
    ]
};

fileSets["combined"] = [...fileSets["2023"], ...fileSets["2024"]];
fileSets["splits-only"] = fileSets["2023"].slice(0, 3).concat(fileSets["2024"]);

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
    const tournamentName = file.split('/').pop().replace('.csv', '').replace(/_/g, ' ');

    if (!tournamentStats[tournamentName]) {
        tournamentStats[tournamentName] = {
        totalYellowCards: 0,
        totalRedCards: 0,
        totalMatches: 0,
        players: new Set(),
        teams: new Set()
        };
    }

    const localPlayerStats = {};

    processInChunks(data, 100, (chunk) => {
        chunk.forEach(row => {
            if (!row || !row["Name"] || !row["Team"]) {
            console.warn('Fila con datos incompletos:', row);
            return;
        }
        const name = cleanName(row["Name"]), team = row["Team"];
        if (!name || !team) return;

        const matches = parseInt(row["PM"]) || 0;
        const yellowCards = parseInt(row["Y.C."]) || 0;
        const redCards = parseInt(row["R.C."]) || 0;

        tournamentStats[tournamentName].totalYellowCards += yellowCards;
        tournamentStats[tournamentName].totalRedCards += redCards;
        tournamentStats[tournamentName].totalMatches += matches;
        tournamentStats[tournamentName].players.add(name);
        tournamentStats[tournamentName].teams.add(team);

        if (!localPlayerStats[name]) {
            localPlayerStats[name] = {
            name: row["Name"].trim(),
            teams: new Set(),
            matches: 0,
            yellowCards: 0,
            redCards: 0,
            timeline: []
            };
        }

        localPlayerStats[name].teams.add(team);
        localPlayerStats[name].matches += matches;
        localPlayerStats[name].yellowCards += yellowCards;
        localPlayerStats[name].redCards += redCards;
        localPlayerStats[name].timeline.push({
            torneo: tournamentName,
            matches: matches,
            yellowCards: yellowCards,
            redCards: redCards,
            totalCards: yellowCards + redCards
        });
        });

        resolve(Object.values(localPlayerStats));
    });
    });
}

function explainPlayer(p) {
    const totalCards = p.yellowCards + p.redCards;
    const teams = Array.from(p.teams).join(", ");

    let html = `<div style="max-width: 500px;">`;
    html += `<strong>${p.name}</strong><br>`;
    html += `<strong>Equipos</strong><br>`;
    html += `(${teams})<br>`;
    html += `<strong>Partidos jugados: ${p.matches}</strong><br>`;
    html += `<strong>Total tarjetas: ${totalCards}</strong><br>`;
    html += `- ${p.yellowCards} amarillas (${((p.yellowCards / totalCards) * 100).toFixed(1)}%)<br>`;
    html += `- ${p.redCards} rojas (${((p.redCards / totalCards) * 100).toFixed(1)}%)<br>`;
    html += `<strong>Promedio por partido:</strong> ${(totalCards / p.matches).toFixed(2)} tarjetas<br><br>`;

    if (p.timeline.length > 1) {
    html += `<u>Torneos:</u><br>`;
    p.timeline.forEach(t => {
        html += `• ${t.torneo}: ${t.totalCards} tarjetas (${t.yellowCards}A/${t.redCards}R)<br>`;
    });
    }

    html += `</div>`;
    return html;
}

function drawCorrelationCharts(players) {
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
        x: players.map(p => p.yellowCards),
        y: players.map(p => p.redCards),
        mode: 'markers',
        type: 'scatter',
        text: players.map(p => p.name),
        marker: { size: 8 }
    };

    Plotly.newPlot(chartDiv, [trace], {
        title: 'Correlación entre Tarjetas Amarillas y Rojas',
        xaxis: { title: 'Tarjetas Amarillas' },
        yaxis: { title: 'Tarjetas Rojas' },
        margin: { t: 50 }
    });

    const description = document.createElement("p");
    description.className = "text-lg text-gray-700 mt-4 p-4";
    description.innerText = "Este gráfico muestra cómo se relacionan las tarjetas amarillas con las rojas. Cada punto representa a un jugador. Una correlación positiva sugiere que los jugadores que reciben más tarjetas amarillas también tienden a recibir más tarjetas rojas.";
    scatterDiv.appendChild(description);
}

async function runAdvancedML(players) {
    const tfDiv = document.createElement("div");
    tfDiv.className = "bg-white rounded shadow p-4 col-span-2";
    tfDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Predicción de Comportamiento por la Inteligencia Artificial</h3>';
    document.getElementById("dashboard").appendChild(tfDiv);

    try {
    await tf.ready();

    const filteredPlayers = players.filter(p => p.matches > 0);
    const features = filteredPlayers.map(p => [
        p.yellowCards / 10,
        p.redCards / 5,
        p.matches / 50
    ]);
    
    const labels = filteredPlayers.map(p => [
        (p.yellowCards * 0.5 + p.redCards * 1.5) / 10
    ]);
    
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);
    
    // Modelo
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [3] }));
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
    
    const topPlayers = [...filteredPlayers].sort((a, b) => (b.yellowCards + b.redCards) - (a.yellowCards + a.redCards)).slice(0, 3);
    topPlayers.forEach(p => {
        const input = tf.tensor2d([[
        p.yellowCards / 10,
        p.redCards / 5,
        p.matches / 50
        ]]);
        
        const prediction = model.predict(input).dataSync()[0] * 10;
        const predictionElement = document.createElement("div");
        predictionElement.className = "mb-2 p-2 bg-blue-50 rounded";
        
        let interpretacion = "";
        if (prediction >= 8) {
            interpretacion = "⚠️ Jugador muy conflictivo";
        } else if (prediction >= 5) {
            interpretacion = "🔴 Jugador con tendencia a faltas";
        } else if (prediction >= 3) {
            interpretacion = "🟡 Jugador con algunas faltas";
        } else {
            interpretacion = "✅ Jugador disciplinado";
        }

        predictionElement.innerHTML = `
            <p><strong>${p.name}</strong>: Índice de comportamiento: ${prediction.toFixed(1)}/10</p>
            <p class="text-sm text-gray-700">${interpretacion}</p>
        `;
        tfDiv.appendChild(predictionElement);
    });
    } catch (error) {
        console.error("Error en TensorFlow:", error);
        tfDiv.innerHTML += '<p class="text-red-500">Error al procesar el modelo predictivo</p>';
    }
    
    let divElement = document.createElement("div");
    divElement.innerHTML = '<p class="text-sm text-gray-600 mb-4">Estos resultados son aproximados: la inteligencia artificial puede variar ligeramente en cada carga, pero ofrece predicciones muy similares. Su objetivo es ayudar a estimar el comportamiento de cada jugador de forma objetiva.<\p>';
    tfDiv.appendChild(divElement);
}

function clusterPlayers(players) {
    const clusterDiv = document.createElement("div");
    clusterDiv.className = "bg-white rounded shadow p-4 col-span-2";
    clusterDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Agrupación de Jugadores por Comportamiento</h3>';
    document.getElementById("dashboard").appendChild(clusterDiv);

    try {
    const data = players
        .filter(p => p.yellowCards + p.redCards > 0)
        .map(p => ({
        name: p.name,
        features: [p.yellowCards, p.redCards * 2, p.matches],
        totalCards: p.yellowCards + p.redCards
        }));

    const maxValues = [0, 0, 0];
    data.forEach(d => {
        d.features.forEach((f, i) => {
        if (f > maxValues[i]) maxValues[i] = f;
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
            Math.pow(d.features[2] - c[2], 2)
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

    Object.entries(clusterGroups).forEach(([cluster, players]) => {
        const clusterElement = document.createElement("div");
        clusterElement.className = "mb-4 p-3 bg-gray-50 rounded";
        clusterElement.innerHTML = `<h4 class="font-semibold mb-2">Grupo ${parseInt(cluster) + 1} (${players.length} jugadores)</h4>`;

        const sortedPlayers = [...players].sort((a, b) => b.totalCards - a.totalCards);
        const topPlayers = sortedPlayers.slice(0, 5);
        const restPlayers = sortedPlayers.slice(5);

        topPlayers.forEach(p => {
            const playerElement = document.createElement("div");
            playerElement.className = "text-sm mb-1";
            playerElement.textContent = `${p.name}: ${data.find(d => d.name === p.name).totalCards} tarjetas totales`;
            clusterElement.appendChild(playerElement);
        });

        if (restPlayers.length > 0) {
        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = "Ver más jugadores";
        toggleBtn.className = "text-blue-500 text-xs mt-2 hover:underline";
        toggleBtn.style.cursor = "pointer";

        const restContainer = document.createElement("div");
        restContainer.style.display = "none";

        restPlayers.forEach(p => {
            const playerElement = document.createElement("div");
            playerElement.className = "text-sm mb-1";
            playerElement.textContent = `${p.name}: ${data.find(d => d.name === p.name).totalCards} tarjetas totales`;
            restContainer.appendChild(playerElement);
        });

        toggleBtn.addEventListener("click", () => {
            const visible = restContainer.style.display === "block";
            restContainer.style.display = visible ? "none" : "block";
            toggleBtn.textContent = visible ? "Ver más jugadores" : "Ocultar jugadores";
        });

        clusterElement.appendChild(toggleBtn);
        clusterElement.appendChild(restContainer);
        }

        const avgFeatures = [0, 0, 0];
        players.forEach(p => {
            p.features.forEach((f, i) => {
                avgFeatures[i] += f * (maxValues[i] || 1);
            });
        });

        avgFeatures.forEach((f, i) => avgFeatures[i] = (f / players.length).toFixed(1));

        const descElement = document.createElement("div");
        descElement.className = "text-xs mt-2 p-2 bg-white rounded";
        descElement.innerHTML = `
            <p><strong>Perfil promedio:</strong></p>
            <p>Tarjetas amarillas: ${avgFeatures[0]}</p>
            <p>Tarjetas rojas: ${avgFeatures[1]}</p>
            <p>Partidos jugados: ${avgFeatures[2]}</p>
        `;
        clusterElement.appendChild(descElement);

        clusterDiv.appendChild(clusterElement);
    });
    } catch (error) {
    console.error("Error en clustering:", error);
    clusterDiv.innerHTML += '<p class="text-red-500">Error al agrupar jugadores</p>';
    }
}

function generateStorytelling(players, tournaments) {
    const storyDiv = document.createElement("div");
    storyDiv.className = "bg-white rounded shadow p-4 col-span-2";
    storyDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Narrativa de las Tarjetas en los Torneos de la Kings analizada por la Inteligencia Artificial</h3>';
    document.getElementById("dashboard").appendChild(storyDiv);

    const topCards = [...players].sort((a, b) => 
    (b.yellowCards + b.redCards) - (a.yellowCards + a.redCards)
    ).slice(0, 3);

    const topTournament = Object.entries(tournaments).sort((a, b) => 
        (b[1].totalYellowCards + b[1].totalRedCards) - (a[1].totalYellowCards + a[1].totalRedCards)
        )[0];

    const mostDisciplined = [...players]
        .filter(p => p.matches >= 5)
        .sort((a, b) => 
            (a.yellowCards + a.redCards) - (b.yellowCards + b.redCards)
        )[0];

    let story = `<div class="prose max-w-none">`;
    
    story += `<h4 class="font-semibold text-blue-800">Resumen de la Temporada</h4>`;
    story += `<p>En un emocionante torneo que contó con ${Object.keys(tournaments).length} competiciones distintas, `;
    story += `los jugadores recibieron un total de ${Object.values(tournaments).reduce((sum, t) => sum + t.totalYellowCards, 0)} tarjetas amarillas y `;
    story += `${Object.values(tournaments).reduce((sum, t) => sum + t.totalRedCards, 0)} tarjetas rojas. `;
    story += `El torneo más conflictivo fue <strong>${topTournament[0]}</strong> con ${topTournament[1].totalYellowCards + topTournament[1].totalRedCards} tarjetas.</p>`;
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">Los Jugadores Más Sancionados</h4>`;
    topCards.forEach((p, i) => {
    story += `<p>${i+1}. <strong>${p.name}</strong> lidera la tabla con un total de ${p.yellowCards + p.redCards} tarjetas: `;
    story += `${p.yellowCards} amarillas y ${p.redCards} rojas. `;
    story += `Un comportamiento agresivo que incluye participación con ${Array.from(p.teams).join(" y ")}.</p>`;
    });
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">El Jugador Más Disciplinado</h4>`;
    story += `<p><strong>${mostDisciplined.name}</strong> demostró ser el jugador más disciplinado, `;
    story += `recibiendo solo ${mostDisciplined.yellowCards + mostDisciplined.redCards} tarjetas en ${mostDisciplined.matches} partidos. `;
    story += `Un ejemplo de juego limpio y deportividad.</p>`;
    
    story += `<h4 class="font-semibold text-blue-800 mt-4">Estadísticas Destacadas</h4>`;
    story += `<ul class="list-disc pl-5">`;
    story += `<li>Total de jugadores sancionados: ${players.filter(p => p.yellowCards + p.redCards > 0).length}</li>`;
    story += `<li>Promedio de tarjetas amarillas por partido: ${(Object.values(tournaments).reduce((sum, t) => sum + t.totalYellowCards, 0) / Object.values(tournaments).reduce((sum, t) => sum + t.totalMatches, 0)).toFixed(2)}</li>`;
    story += `<li>Promedio de tarjetas rojas por partido: ${(Object.values(tournaments).reduce((sum, t) => sum + t.totalRedCards, 0) / Object.values(tournaments).reduce((sum, t) => sum + t.totalMatches, 0)).toFixed(2)}</li>`;
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

    for (const key in playerStats) delete playerStats[key];
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
        skipEmptyLines: true,
        complete: results => {
            processData(file, results.data).then(resolve).catch(reject);
        },
        error: err => reject(err)
        });
    })
    );

    Promise.all(promises).then(results => {
    const mergedPlayers = {};

    results.flat().forEach(player => {
        const name = player.name;
        if (!mergedPlayers[name]) {
        mergedPlayers[name] = {
            ...player,
            teams: new Set(player.teams),
            timeline: [...player.timeline]
        };
        } else {
            mergedPlayers[name].matches += player.matches;
            mergedPlayers[name].yellowCards += player.yellowCards;
            mergedPlayers[name].redCards += player.redCards;
            player.teams.forEach(t => mergedPlayers[name].teams.add(t));
            mergedPlayers[name].timeline.push(...player.timeline);
        }
    });

    const playersArray = Object.values(mergedPlayers).map(p => ({
        ...p,
        team: Array.from(p.teams).join(", "),
        totalCards: p.yellowCards + p.redCards
    }));

    drawBasicCharts(playersArray);
    drawCorrelationCharts(playersArray);
    runAdvancedML(playersArray);
    clusterPlayers(playersArray);
    generateStorytelling(playersArray, tournamentStats);

    document.getElementById("loading").classList.add("hidden");
    isLoading = false;
    }).catch(err => {
        console.error("Error procesando archivos:", err);
        document.getElementById("loading").classList.add("hidden");
        isLoading = false;
    });
}

function drawBasicCharts(players) {
    const categories = [
        { key: 'yellowCards', label: 'Tarjetas Amarillas', color: '#F59E0B' },
        { key: 'redCards', label: 'Tarjetas Rojas', color: '#EF4444' },
        { key: 'totalCards', label: 'Total Tarjetas', color: '#8B5CF6' }
    ];

    categories.forEach(cat => {
    const top = [...players].filter(p => p[cat.key] > 0).sort((a, b) => b[cat.key] - a[cat.key]).slice(0, 10);
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
            const player = players.find(p => p.name === params.name);
            return explainPlayer(player);
        }
        },
        xAxis: {
        type: 'category',
        data: top.map(p => p.name),
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
        data: top.map(p => p[cat.key]),
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

    const topPlayers = [...players].sort((a, b) => b.totalCards - a.totalCards).slice(0, 3);
    if (topPlayers.length > 0) {
    const timelineDiv = document.createElement("div");
    timelineDiv.className = "bg-white rounded shadow p-4";
    timelineDiv.style.height = "400px";
    document.getElementById("dashboard").appendChild(timelineDiv);
    
    const series = topPlayers.map(p => ({
        name: p.name,
        type: 'line',
        data: p.timeline.map(t => t.totalCards),
        smooth: true
    }));
    
    echarts.init(timelineDiv).setOption({
        title: { text: 'Evolución de Tarjetas por Torneo (Top 3)', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: topPlayers.map(p => p.name), top: 30 },
        xAxis: {
        type: 'category',
        data: topPlayers[0].timeline.map(t => t.torneo),
        axisLabel: { rotate: 30 }
        },
        yAxis: { type: 'value' },
        series: series
    });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    if (fileSets && fileSets['2023']) {
    loadYear('2023');
    } else {
    console.warn("fileSets['2023'] aún no está disponible.");
    }
});
