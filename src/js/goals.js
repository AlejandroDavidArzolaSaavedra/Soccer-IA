document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById('carouselContainer');
    const scrollLeftBtn = document.getElementById('scrollLeft');
    const scrollRightBtn = document.getElementById('scrollRight');
    const cardWidth = 250 + 16;

    scrollLeftBtn.addEventListener('click', () => {
        container.scrollBy({ left: -cardWidth * 4, behavior: 'smooth' });
    });

    scrollRightBtn.addEventListener('click', () => {
        container.scrollBy({ left: cardWidth * 4, behavior: 'smooth' });
    });
});

const cleanName = name => name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const playerStats = {};
const tournamentStats = {};

const fileSets = {
    "2023": [
        "../json/2023_2024/goals/1_split_kings.csv",
        "../json/2023_2024/goals/2_split_kings.csv",
        "../json/2023_2024/goals/3_split_kings.csv",
        "../json/2023_2024/goals/kings_cup.csv",
        "../json/2023_2024/goals/kingdom_cup.csv"
    ],
    "2024": [
        "../json/2024_2025/goals/4_split_kings.csv",
        "../json/2024_2025/goals/5_split_kings.csv"
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
const lista = [];

function processData(file, data) {
    return new Promise((resolve) => {
        const isSplit = file.includes("split");
        const tournamentName = file.split('/').pop().replace('.csv', '').replace(/_/g, ' ');

        if (!tournamentStats[tournamentName]) {
        tournamentStats[tournamentName] = {
            totalGoals: 0,
            players: new Set(),
            teams: new Set()
        };
        }

        const localPlayerStats = {};

        processInChunks(data, 100, (chunk) => {
        chunk.forEach(row => {
            const name = cleanName(row["Name"]), team = row["Team"];
            if (!name || !team) return;

            const goals = parseInt(row[isSplit ? "TG" : "G"]) || 0;
            const gx2 = parseInt(row["Gx2"]) || 0;
            const pen = parseInt(row["Pen"]) || 0;
            const pso = parseInt(row["PSO"]) || 0;
            const total = goals + gx2 + pen + pso;

            tournamentStats[tournamentName].totalGoals += total;
            tournamentStats[tournamentName].players.add(name);
            tournamentStats[tournamentName].teams.add(team);

            if (!localPlayerStats[name]) {
            localPlayerStats[name] = {
                name: row["Name"].trim(),
                teams: new Set(),
                totalGoals: 0,
                pen: 0,
                pso: 0,
                gx2: 0,
                matches: 0,
                timeline: []
            };
            }

            localPlayerStats[name].teams.add(team);
            localPlayerStats[name].totalGoals += goals;
            localPlayerStats[name].pen += pen;
            localPlayerStats[name].pso += pso;
            localPlayerStats[name].gx2 += gx2;
            localPlayerStats[name].matches += 1;
            localPlayerStats[name].timeline.push({
            torneo: tournamentName,
            goles: goals,
            penaltis: pen,
            dobles: gx2,
            pso: pso,
            total: total
            });
        });

        resolve(Object.values(localPlayerStats));
        });
    });
}

function explainPlayer(p) {
    const total = p.totalGoals + p.gx2 + p.pen + p.pso || 1;
    const teams = Array.from(p.teams).join(", ");

    let html = `<div style="max-width: 500px;">`;
    html += `<strong>${p.name}</strong><br>`;
    html += `<strong>Equipos</strong><br>`;
    html += `(${teams})<br>`;
    html += `<strong>Total: ${total} goles </strong><br>`;
    html += `- ${p.totalGoals} normales (${((p.totalGoals / total) * 100).toFixed(1)}%)<br>`;
    html += `- ${p.gx2} dobles (${((p.gx2 / total) * 100).toFixed(1)}%)<br>`;
    html += `- ${p.pen} penaltis (${((p.pen / total) * 100).toFixed(1)}%)<br>`;
    html += `- ${p.pso} PSO (${((p.pso / total) * 100).toFixed(1)}%)<br><br>`;

    if (p.timeline.length > 1) {
        html += `<u>Torneos:</u><br>`;
        p.timeline.forEach(t => {
        html += `• ${t.torneo}: ${t.total} goles<br>`;
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
        x: players.map(p => p.totalGoals),
        y: players.map(p => p.gx2),
        mode: 'markers',
        type: 'scatter',
        text: players.map(p => p.name),
        marker: { size: 8 }
    };

    Plotly.newPlot(chartDiv, [trace], {
        title: 'Correlación entre Goles Normales y Goles Dobles',
        xaxis: { title: 'Goles Normales' },
        yaxis: { title: 'Goles Dobles (Gx2)' },
        margin: { t: 50 }
    });

    const description = document.createElement("p");
    description.className = "text-lg text-gray-700 mt-4 p-4";
    description.innerText = "Este gráfico muestra cómo se relacionan los goles normales con los goles dobles (Gx2). Cada punto representa a un jugador. Una correlación positiva sugiere que quienes marcan más goles normales también tienden a marcar más goles dobles. Una correlación positiva significa que, cuando una variable aumenta, la otra también tiende a aumentar.";
    scatterDiv.appendChild(description);

    function correlation(a, b) {
        const n = a.length;
        const avgA = a.reduce((s, v) => s + v, 0) / n;
        const avgB = b.reduce((s, v) => s + v, 0) / n;
        const num = a.reduce((s, v, i) => s + ((v - avgA) * (b[i] - avgB)), 0);
        const den = Math.sqrt(
        a.reduce((s, v) => s + Math.pow(v - avgA, 2), 0) *
        b.reduce((s, v) => s + Math.pow(v - avgB, 2), 0)
        );
        return num / den;
    }

    }

    async function runAdvancedML(players) {
    const tfDiv = document.createElement("div");
    tfDiv.className = "bg-white rounded shadow p-4 col-span-2";
    tfDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Predicción de Rendimiento por la Inteligencia Artificial</h3>';
    document.getElementById("dashboard").appendChild(tfDiv);

    try {
        await tf.ready();

        const filteredPlayers = players.filter(p => p.matches > 0);
        const features = filteredPlayers.map(p => [
            p.totalGoals / 100,
            p.pen / 20,
            p.pso / 10,
            p.gx2 / 20,
            p.matches / 50
        ]);
        
        const labels = filteredPlayers.map(p => [
            (p.totalGoals + p.gx2 * 2 + p.pen * 0.8 + p.pso * 0.5) / 50
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
        const topPlayers = [...filteredPlayers].sort((a, b) => b.totalGoals - a.totalGoals).slice(0, 3);
        topPlayers.forEach(p => {
        const input = tf.tensor2d([[
            p.totalGoals / 100,
            p.pen / 20,
            p.pso / 10,
            p.gx2 / 20,
            p.matches / 50
        ]]);
        
        const prediction = model.predict(input).dataSync()[0] * 50;
        const predictionElement = document.createElement("div");
        predictionElement.className = "mb-2 p-2 bg-blue-50 rounded";
        let interpretacion = "";
        if (prediction >= 80) {
            interpretacion = "🔥 Jugador excepcional";
        } else if (prediction >= 60) {
            interpretacion = "💪 Jugador destacado";
        } else if (prediction >= 40) {
            interpretacion = "⚙️ Jugador promedio alto";
        } else if (prediction >= 20) {
            interpretacion = "⚠️ Por debajo de lo esperado";
        } else {
            interpretacion = "❌ Rendimiento muy bajo";
        }

predictionElement.innerHTML = `
    <p><strong>${p.name}</strong>: Predicción de rendimiento: ${prediction.toFixed(1)} puntos</p>
    <p class="text-sm text-gray-700">${interpretacion}</p>
`;
        tfDiv.appendChild(predictionElement);
        });
    } catch (error) {
        console.error("Error en TensorFlow:", error);
        tfDiv.innerHTML += '<p class="text-red-500">Error al procesar el modelo predictivo</p>';
    }
    let divElement = document.createElement("div");
    divElement.innerHTML = '<p class="text-sm text-gray-600 mb-4">Estos resultados son aproximados: la inteligencia artificial puede variar ligeramente en cada carga, pero ofrece predicciones muy similares. Su objetivo es ayudar a estimar el rendimiento ofensivo de cada jugador de forma objetiva. Cada rango indica la importancia y la calidad del jugador.<\p>';
    tfDiv.appendChild(divElement);
    
    let divElementText = document.createElement("div");
    divElementText.innerHTML = `
        <p class="text-sm text-gray-600 mb-4">
        Para predecir el rendimiento de los jugadores, se ajustan varias estadísticas clave a la misma escala de la siguiente manera:
        </p>
        <ul class="text-sm text-gray-600 mb-4">
        <li><strong>Goles (totalGoals):</strong> Se dividen entre 100 para evitar que un número elevado de goles influya de manera desproporcionada en el rendimiento.</li>
        <li><strong>Penales (pen):</strong> Se dividen entre 20, otorgándoles un peso menor en comparación con otras métricas.</li>
        <li><strong>Puntos de (pso):</strong> Se dividen entre 10 para asegurar que no tengan un impacto excesivo en la evaluación.</li>
        <li><strong>Goles x2 (gx2):</strong> Se dividen entre 20, representando goles decisivos o de mayor relevancia.</li>
        <li><strong>Partidos jugados (matches):</strong> Se dividen entre 50 para reflejar la experiencia del jugador, dándole más importancia a los partidos jugados en la Kings League.</li>
        </ul>
    `;

    tfDiv.appendChild(divElementText);

    const brainDiv = document.createElement("div");
    brainDiv.className = "bg-white rounded shadow p-4 col-span-2";
    brainDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Analisis de jugadores aleatorios</h3>';
    document.getElementById("dashboard").appendChild(brainDiv);

    try {
        const net = new brain.NeuralNetwork();
        
        net.train(players.map(p => ({
        input: {
            goals: p.totalGoals / 100,
            pen: p.pen / 20,
            pso: p.pso / 10,
            gx2: p.gx2 / 20
        },
        output: {
            goleador: p.totalGoals > 10 ? 1 : 0,
            especialista: (p.pen > 3 || p.pso > 2) ? 1 : 0,
            versatil: (p.gx2 > 2 && p.totalGoals > 5) ? 1 : 0
        }
        })), {
        iterations: 2000,
        log: true, 
        logPeriod: 100
        });

        const examplePlayers = [...players]
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);
        
        examplePlayers.forEach(p => {
        const output = net.run({
            goals: p.totalGoals / 100,
            pen: p.pen / 20,
            pso: p.pso / 10,
            gx2: p.gx2 / 20
        });
        
        const playerType = output.goleador > 0.7 ? "Goleador" :
                        output.especialista > 0.7 ? "Especialista (penaltis/PSO)" :
                        output.versatil > 0.7 ? "Versátil (goles dobles)" : "Equilibrado";
        
        const playerElement = document.createElement("div");
        playerElement.className = "mb-2 p-2 bg-green-50 rounded";
        playerElement.innerHTML = `
            <p><strong>${p.name}</strong>: ${playerType}</p>
            <p class="text-sm text-gray-600">Probabilidades: 
            Goleador ${(output.goleador * 100).toFixed(1)}%, 
            Especialista ${(output.especialista * 100).toFixed(1)}%, 
            Versátil ${(output.versatil * 100).toFixed(1)}%
            </p>
        `;
        brainDiv.appendChild(playerElement);
        });
    } catch (error) {
        console.error("Error en Brain.js:", error);
        brainDiv.innerHTML += '<p class="text-red-500">Error al clasificar jugadores</p>';
    }
}

function clusterPlayers(players) {
    const clusterDiv = document.createElement("div");
    clusterDiv.className = "bg-white rounded shadow p-4 col-span-2";
    clusterDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Agrupación de Jugadores por Estilo</h3>';
    document.getElementById("dashboard").appendChild(clusterDiv);

    try {
        const data = players
            .filter(p => p.totalGoals + p.gx2 + p.pen + p.pso > 0)
            .map(p => ({
                name: p.name,
                features: [p.totalGoals, p.gx2 * 2, p.pen, p.pso],
                total: p.totalGoals + p.gx2 + p.pen + p.pso
        }));

        const maxValues = [0, 0, 0, 0];
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

        Object.entries(clusterGroups).forEach(([cluster, players]) => {
        const clusterElement = document.createElement("div");
        clusterElement.className = "mb-4 p-3 bg-gray-50 rounded";
        clusterElement.innerHTML = `<h4 class="font-semibold mb-2">Grupo ${parseInt(cluster) + 1} (${players.length} jugadores)</h4>`;

        const sortedPlayers = [...players].sort((a, b) => b.total - a.total);
        const topPlayers = sortedPlayers.slice(0, 5);
        const restPlayers = sortedPlayers.slice(5);

        topPlayers.forEach(p => {
            const playerElement = document.createElement("div");
            playerElement.className = "text-sm mb-1";
            playerElement.textContent = `${p.name}: ${data.find(d => d.name === p.name).total} goles totales`;
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
            playerElement.textContent = `${p.name}: ${data.find(d => d.name === p.name).total} goles totales`;
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

        const avgFeatures = [0, 0, 0, 0];
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
            <p>Goles normales: ${avgFeatures[0]}</p>
            <p>Goles dobles: ${avgFeatures[1]}</p>
            <p>Penaltis: ${avgFeatures[2]}</p>
            <p>PSO: ${avgFeatures[3]}</p>
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
        storyDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Narrativa de los Torneos de la Kings analizada por la Inteligencia Artificial</h3>';
        document.getElementById("dashboard").appendChild(storyDiv);

        const topScorers = [...players].sort((a, b) => 
            (b.totalGoals + b.gx2 + b.pen + b.pso) - (a.totalGoals + a.gx2 + a.pen + a.pso)
        ).slice(0, 3);

        const topTournament = Object.entries(tournaments).sort((a, b) => b[1].totalGoals - a[1].totalGoals)[0];
        const mostVersatile = [...players].sort((a, b) => {
            const aScore = (a.totalGoals > 0 ? 1 : 0) + (a.gx2 > 0 ? 1 : 0) + (a.pen > 0 ? 1 : 0) + (a.pso > 0 ? 1 : 0);
            const bScore = (b.totalGoals > 0 ? 1 : 0) + (b.gx2 > 0 ? 1 : 0) + (b.pen > 0 ? 1 : 0) + (b.pso > 0 ? 1 : 0);
            return bScore - aScore || (b.totalGoals + b.gx2 + b.pen + b.pso) - (a.totalGoals + a.gx2 + a.pen + a.pso);
        })[0];

        let story = `<div class="prose max-w-none">`;
        
        story += `<h4 class="font-semibold text-blue-800">Resumen de la Temporada</h4>`;
        story += `<p>En un emocionante torneo que contó con ${Object.keys(tournaments).length} competiciones distintas, `;
        story += `los jugadores demostraron su calidad goleadora con un total de ${Object.values(tournaments).reduce((sum, t) => sum + t.totalGoals, 0)} goles. `;
        story += `El torneo más productivo fue <strong>${topTournament[0]}</strong> con ${topTournament[1].totalGoals} goles.</p>`;
        
        story += `<h4 class="font-semibold text-blue-800 mt-4">Los Goleadores Estrella</h4>`;
        topScorers.forEach((p, i) => {
            story += `<p>${i+1}. <strong>${p.name}</strong> lidera la tabla con un total de ${p.totalGoals + p.gx2 + p.pen + p.pso} goles: `;
            story += `${p.totalGoals} normales, ${p.gx2} dobles, ${p.pen} de penalti y ${p.pso} en PSO. `;
            story += `Un rendimiento destacado que incluye participación con ${Array.from(p.teams).join(" y ")}.</p>`;
        });
        
        story += `<h4 class="font-semibold text-blue-800 mt-4">El Jugador Más Versátil</h4>`;
        story += `<p><strong>${mostVersatile.name}</strong> demostró ser el jugador más completo, `;
        story += `marcando goles de ${mostVersatile.totalGoals > 0 ? 'juego normal, ' : ''}${mostVersatile.gx2 > 0 ? 'doble, ' : ''}${mostVersatile.pen > 0 ? 'penalti, ' : ''}${mostVersatile.pso > 0 ? 'PSO' : ''}. `;
        story += `Una habilidad multifacética que lo convierte en un activo valioso para cualquier equipo.</p>`;
        
        story += `<h4 class="font-semibold text-blue-800 mt-4">Estadísticas Destacadas</h4>`;
        story += `<ul class="list-disc pl-5">`;
        story += `<li>Total de jugadores participantes: ${players.length}</li>`;
        story += `<li>Equipos representados: ${new Set(Object.values(tournaments).flatMap(t => Array.from(t.teams))).size}</li>`;
        story += `<li>Goles más comunes: normales (${players.reduce((sum, p) => sum + p.totalGoals, 0)})</li>`;
        story += `<li>Goles más decisivos: dobles (${players.reduce((sum, p) => sum + p.gx2, 0)})</li>`;
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
            mergedPlayers[name].totalGoals += player.totalGoals;
            mergedPlayers[name].pen += player.pen;
            mergedPlayers[name].pso += player.pso;
            mergedPlayers[name].gx2 += player.gx2;
            mergedPlayers[name].matches += player.matches;
            player.teams.forEach(t => mergedPlayers[name].teams.add(t));
            mergedPlayers[name].timeline.push(...player.timeline);
        }
    });

    const playersArray = Object.values(mergedPlayers).map(p => ({
        ...p,
        team: Array.from(p.teams).join(", "),
        total: p.totalGoals + p.gx2 + p.pen + p.pso
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
        { key: 'totalGoals', label: 'Goles Normales', color: '#60A5FA' },
        { key: 'gx2', label:'Goles Dobles (Gx2)', color: '#F59E0B' },
        { key: 'pen', label: 'Penaltis', color: '#10B981' },
        { key: 'pso', label: 'PSO', color: '#EC4899' },
        { key: 'total', label: 'Total Goleador', color: '#6366F1' }
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

const topPlayers = [...players].sort((a, b) => b.total - a.total).slice(0, 3);
if (topPlayers.length > 0) {
    const timelineDiv = document.createElement("div");
    timelineDiv.className = "bg-white rounded shadow p-4";
    timelineDiv.style.height = "400px";
    document.getElementById("dashboard").appendChild(timelineDiv);
    
    const series = topPlayers.map(p => ({
        name: p.name,
        type: 'line',
        data: p.timeline.map(t => t.total),
        smooth: true
    }));
    
    echarts.init(timelineDiv).setOption({
        title: { text: 'Evolución por Torneo de la Kings (Top 3 Goleadores)', left: 'center' },
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