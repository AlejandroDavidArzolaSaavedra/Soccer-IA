const fileSets = {
    "2023": [
      "../json/2023_2024/match_MVP/1_split_kings.csv",
      "../json/2023_2024/match_MVP/2_split_kings.csv",
      "../json/2023_2024/match_MVP/3_split_kings.csv",
    ],
    "2024": [
      "../json/2024_2025/match_MVP/4_split_kings.csv",
      "../json/2024_2025/match_MVP/5_split_kings.csv"
    ]
  };
fileSets["combined"] = [...fileSets["2023"], ...fileSets["2024"]];
fileSets["splits-only"] = fileSets["2023"].slice(0, 3).concat(fileSets["2024"]);

const cleanName = name => {
  if (!name || typeof name !== 'string') return ''; 
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

function processData(file, data) {
  return new Promise((resolve) => {
    const tournamentName = file.split('/').pop().replace('.csv', '').replace(/_/g, ' ');
    const players = {};

    data.forEach(row => {
      const name = cleanName(row["Name"]);
      if (!name) return;

      if (!players[name]) {
        players[name] = {
          name: row["Name"].trim(),
          team: row["Team"],
          pm: parseInt(row["PM"]) || 0,
          mvps: parseInt(row["MVP"]) || 0,
          tournaments: new Set([tournamentName])
        };
      } else {
        players[name].pm += parseInt(row["PM"]) || 0;
        players[name].mvps += parseInt(row["MVP"]) || 0;
        players[name].tournaments.add(tournamentName);
      }
    });

    resolve(Object.values(players));
  });
}

function explainPlayer(p) {
  const efficiency = p.pm > 0 ? ((p.mvps / p.pm) * 100).toFixed(1) : 0;
  
  let html = `<div style="max-width: 500px;">`;
  html += `<strong>${p.name}</strong><br>`;
  html += `<strong>Equipo:</strong> ${p.team}<br>`;
  html += `<span class="mvp-badge">${p.mvps} MVP</span><br>`;
  html += `<strong>Partidos como MVP:</strong> ${p.pm}<br>`;
  html += `<strong>Eficiencia:</strong> ${efficiency}%<br><br>`;
  
  if (p.tournaments.length > 1) {
    html += `<u>Torneos:</u><br>`;
    html += `• ${Array.from(p.tournaments).join('<br>• ')}`;
  }

  html += `</div>`;
  return html;
}

function drawMVPCharts(players) {
  const sortedByMVPs = [...players].sort((a, b) => b.mvps - a.mvps || b.pm - a.pm);
  const topMVPs = sortedByMVPs.slice(0, 15);
  const mvpChartDiv = document.createElement("div");
  mvpChartDiv.className = "bg-white rounded shadow p-4";
  mvpChartDiv.style.height = "500px";
  document.getElementById("dashboard").appendChild(mvpChartDiv);
  
  const mvpChart = echarts.init(mvpChartDiv);
  mvpChart.setOption({
    title: { 
      text: 'Top 15 - Jugadores con más MVP', 
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      formatter: params => {
        const player = players.find(p => p.name === params.name);
        return explainPlayer(player);
      }
    },
    xAxis: {
      type: 'category',
      data: topMVPs.map(p => p.name),
      axisLabel: {
        rotate: 30,
        interval: 0,
        fontSize: 10,
        formatter: value => value.length > 15 ? value.slice(0, 12) + '...' : value
      }
    },
    yAxis: { 
      type: 'value',
      name: 'Número de MVP'
    },
    series: [{
      data: topMVPs.map(p => p.mvps),
      type: 'bar',
      itemStyle: { color: '#FFD700' },
      emphasis: { itemStyle: { color: '#8E0303' } },
      label: {
        show: true,
        position: 'top',
        formatter: '{c}'
      }
    }],
    grid: {
      left: '10%',
      right: '10%',
      bottom: '25%',
      top: '15%'
    }
  });

  const relationChartDiv = document.createElement("div");
  relationChartDiv.className = "bg-white rounded shadow p-4";
  relationChartDiv.style.height = "500px";
  document.getElementById("dashboard").appendChild(relationChartDiv);
  
  const relationChart = echarts.init(relationChartDiv);
  relationChart.setOption({
    title: { 
      text: 'Relación Partidos MVP vs Número de MVP', 
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      formatter: params => {
        const player = players.find(p => p.name === params.data[2]);
        return explainPlayer(player);
      }
    },
    xAxis: {
      type: 'value',
      name: 'Partidos como MVP (PM)'
    },
    yAxis: {
      type: 'value',
      name: 'Número de MVP'
    },
    series: [{
      data: players.map(p => [p.pm, p.mvps, p.name]),
      type: 'scatter',
      symbolSize: function(data) {
        return Math.sqrt(data[1]) * 4 + 4;
      },
      itemStyle: {
        color: function(params) {
          const ratio = params.data[1] / (params.data[0] || 1);
          return ratio > 0.5 ? '#8E0303' : ratio > 0.3 ? '#FFA500' : '#FFD700';
        }
      },
      label: {
        show: true,
        formatter: function(params) {
          return params.data[1] >= 3 ? params.data[2].split(' ')[0] : '';
        },
        position: 'top',
        fontSize: 10
      }
    }],
    grid: {
      left: '15%',
      right: '10%',
      bottom: '15%',
      top: '15%'
    }
  });
}

async function predictPerformance(players) {
  const tfDiv = document.createElement("div");
  tfDiv.className = "bg-white rounded shadow p-4 col-span-2 ai-section";
  tfDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Predicción de Rendimiento por la Inteligencia Artificial</h3>';
  document.getElementById("dashboard").appendChild(tfDiv);

  try {
    await tf.ready();
    const filteredPlayers = players.filter(p => p.pm > 0);
    const features = filteredPlayers.map(p => [
      p.mvps / 10,
      p.pm / 20,
      (p.mvps / (p.pm || 1)) * 10
    ]);
    
    const labels = filteredPlayers.map(p => [
      (p.mvps * 2 + p.pm * 0.5) / 10
    ]);
    
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);
    
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [3] }));
    model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
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
    
    const topPlayers = [...filteredPlayers].sort((a, b) => b.mvps - a.mvps).slice(0, 3);
    
    topPlayers.forEach(p => {
      const input = tf.tensor2d([[
        p.mvps / 5,
        p.pm / 10,
        (p.mvps / (p.pm || 1)) * 10
      ]]);
      
      const prediction = model.predict(input).dataSync()[0] * 10;
      const predictionElement = document.createElement("div");
      predictionElement.className = "mb-2 p-2 bg-blue-50 rounded";
      
      let interpretacion = "";
      if (prediction >= 20) {
        interpretacion = "🔥 MVP Excepcional";
      } else if (prediction >= 60) {
        interpretacion = "💪 MVP Destacado";
      } else if (prediction >= 40) {
        interpretacion = "⚙️ MVP Regular";
      } else if (prediction >= 20) {
        interpretacion = "⚠️ Por debajo de lo esperado";
      } else {
        interpretacion = "❌ Rendimiento bajo";
      }

      predictionElement.innerHTML = `
        <p><strong>${p.name}</strong>: Puntuación de rendimiento: ${prediction.toFixed(1)}/100</p>
        <p class="text-sm text-gray-700">${interpretacion}</p>
      `;
      tfDiv.appendChild(predictionElement);
    });
    
    const infoDiv = document.createElement("div");
    infoDiv.className = "text-sm text-gray-600 mt-4 p-2 bg-white rounded";
    infoDiv.innerHTML = `
      <p><strong>Nota:</strong> Este modelo predice el rendimiento futuro basado en:</p>
      <ul class="list-disc pl-5 mt-2">
        <li>Número de MVP obtenidos</li>
        <li>Partidos jugados como MVP</li>
        <li>Eficiencia (MVP por partido)</li>
      </ul>
      <p class="mt-2">Los resultados son aproximados y pueden variar en cada ejecución.</p>
    `;
    tfDiv.appendChild(infoDiv);
    
  } catch (error) {
    console.error("Error en TensorFlow:", error);
    tfDiv.innerHTML += '<p class="text-red-500">Error al procesar el modelo predictivo</p>';
  }
}

function classifyPlayers(players) {
  const brainDiv = document.createElement("div");
  brainDiv.className = "bg-white rounded shadow p-4 col-span-2 ai-section";
  brainDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Análisis de Jugadores Aleatorios</h3>';
  document.getElementById("dashboard").appendChild(brainDiv);

  try {
    const net = new brain.NeuralNetwork();
    
    net.train(players.map(p => ({
      input: {
        mvps: p.mvps / 10,
        pm: p.pm / 20,
        efficiency: (p.mvps / (p.pm || 1)) * 5
      },
      output: {
        mvp: p.mvps > 3 ? 1 : 0,
        consistente: (p.pm > 5 && (p.mvps / p.pm) > 0.3) ? 1 : 0,
        emergente: (p.mvps > 0 && p.mvps <= 2) ? 1 : 0
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
        mvps: p.mvps / 10,
        pm: p.pm / 20,
        efficiency: (p.mvps / (p.pm || 1)) * 5
      });
      
      const playerType = output.mvp > 0.7 ? "MVP Estrella" :
                        output.consistente > 0.7 ? "MVP Consistente" :
                        output.emergente > 0.7 ? "MVP Emergente" : "MVP Ocasional";
      
      const playerElement = document.createElement("div");
      playerElement.className = "mb-2 p-2 bg-green-50 rounded";
      playerElement.innerHTML = `
        <p><strong>${p.name}</strong>: ${playerType}</p>
        <p class="text-sm text-gray-600">Probabilidades: 
          Estrella ${(output.mvp * 100).toFixed(1)}%, 
          Consistente ${(output.consistente * 100).toFixed(1)}%, 
          Emergente ${(output.emergente * 100).toFixed(1)}%
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
  clusterDiv.className = "bg-white rounded shadow p-4 col-span-2 ai-section";
  clusterDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Agrupación de Jugadores por Estilo</h3>';
  document.getElementById("dashboard").appendChild(clusterDiv);

  try {
    const filteredPlayers = players.filter(p => p.pm > 0);
    const data = filteredPlayers.map(p => ({
      name: p.name,
      features: [p.mvps, p.pm, (p.mvps / p.pm) * 10],
      total: p.mvps + p.pm
    }));

    const k = 3;
    const centroids = [];
    for (let i = 0; i < k; i++) {
      centroids.push(data[Math.floor(Math.random() * data.length)].features);
    }

    const clusteredData = data.map(d => {
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
      
      const avgMvps = players.reduce((sum, p) => sum + p.features[0], 0) / players.length;
      const avgPm = players.reduce((sum, p) => sum + p.features[1], 0) / players.length;
      const avgEff = players.reduce((sum, p) => sum + p.features[2], 0) / players.length;
      
      let clusterType = "";
      if (avgMvps > 3 && avgEff > 5) {
        clusterType = "MVP Estrellas";
      } else if (avgPm > 5 && avgEff > 3) {
        clusterType = "MVP Consistentes";
      } else {
        clusterType = "MVP Ocasionales";
      }

      clusterElement.innerHTML = `<h4 class="font-semibold mb-2">Grupo ${parseInt(cluster) + 1}: ${clusterType} (${players.length} jugadores)</h4>`;
      
      const topPlayers = [...players].sort((a, b) => b.total - a.total).slice(0, 5);
      topPlayers.forEach(p => {
        const playerElement = document.createElement("div");
        playerElement.className = "text-sm mb-1";
        playerElement.textContent = `${p.name}: ${p.features[0]} MVP (${p.features[1]} partidos)`;
        clusterElement.appendChild(playerElement);
      });
      
      clusterDiv.appendChild(clusterElement);
    });
  } catch (error) {
    console.error("Error en clustering:", error);
    clusterDiv.innerHTML += '<p class="text-red-500">Error al agrupar jugadores</p>';
  }
}

function generateStorytelling(players) {
  const storyDiv = document.createElement("div");
  storyDiv.className = "bg-white rounded shadow p-4 col-span-2 ai-section";
  storyDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Narrativa de los Torneos Analizada por la Inteligencia Artificial</h3>';
  document.getElementById("dashboard").appendChild(storyDiv);

  const topPlayers = [...players].sort((a, b) => b.mvps - a.mvps).slice(0, 3);
  const mostEfficient = [...players].filter(p => p.pm > 3)
    .sort((a, b) => (b.mvps / b.pm) - (a.mvps / a.pm))[0];
  
  let story = `<div class="prose max-w-none">`;
  story += `<p>En el análisis de los MVP de la Kings League, destacan:</p>`;
  
  story += `<h4 class="font-semibold text-blue-800 mt-4">Los MVP más destacados</h4>`;
  topPlayers.forEach((p, i) => {
    story += `<p>${i+1}. <strong>${p.name}</strong> con ${p.mvps} MVP en ${p.pm} partidos `;
    story += `(${(p.mvps / p.pm * 100).toFixed(1)}% de eficiencia).</p>`;
  });
  
  story += `<h4 class="font-semibold text-blue-800 mt-4">El MVP más eficiente</h4>`;
  story += `<p><strong>${mostEfficient.name}</strong> tiene la mejor eficiencia, `;
  story += `con ${mostEfficient.mvps} MVP en solo ${mostEfficient.pm} partidos `;
  story += `(${(mostEfficient.mvps / mostEfficient.pm * 100).toFixed(1)}% de efectividad).</p>`;
  
  story += `<h4 class="font-semibold text-blue-800 mt-4">Estadísticas clave</h4>`;
  story += `<ul class="list-disc pl-5">`;
  story += `<li>Total de jugadores con al menos 1 MVP: ${players.filter(p => p.mvps > 0).length}</li>`;
  story += `<li>Promedio de MVP por jugador: ${(players.reduce((sum, p) => sum + p.mvps, 0) / players.length).toFixed(1)}</li>`;
  story += `<li>Eficiencia promedio: ${(players.filter(p => p.pm > 0).reduce((sum, p) => sum + (p.mvps / p.pm), 0) * 100 / players.filter(p => p.pm > 0).length).toFixed(1)}%</li>`;
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
      const name = cleanName(player.name);
      if (!mergedPlayers[name]) {
        mergedPlayers[name] = {
          ...player,
          tournaments: new Set(player.tournaments)
        };
      } else {
        mergedPlayers[name].pm += player.pm;
        mergedPlayers[name].mvps += player.mvps;
        player.tournaments.forEach(t => mergedPlayers[name].tournaments.add(t));
      }
    });

    const playersArray = Object.values(mergedPlayers).map(p => ({
      ...p,
      tournaments: Array.from(p.tournaments)
    }));

    drawMVPCharts(playersArray);
    predictPerformance(playersArray);
    classifyPlayers(playersArray);
    clusterPlayers(playersArray);
    generateStorytelling(playersArray);

    document.getElementById("loading").classList.add("hidden");
    isLoading = false;
  }).catch(err => {
    console.error("Error procesando archivos:", err);
    document.getElementById("loading").classList.add("hidden");
    isLoading = false;
  });
}

document.addEventListener("DOMContentLoaded", function() {
  if (fileSets && fileSets['2023']) {
    loadYear('2023');
  }
});