const cleanName = name => {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const playerStats = {};
const tournamentStats = {};

const fileSets = {
  "2023": [
    "../json/2023_2024/passing/1_split_kings.csv",
    "../json/2023_2024/passing/2_split_kings.csv", 
    "../json/2023_2024/passing/3_split_kings.csv",
  ],
  "2024": [
    "../json/2024_2025/passing/4_split_kings.csv",
    "../json/2024_2025/passing/5_split_kings.csv"
  ]
};

fileSets["combined"] = [...fileSets["2023"], ...fileSets["2024"]];
fileSets["splits-only"] = fileSets["2023"].slice(0, 3).concat(fileSets["2024"]);

function processInChunks(data, chunkSize, callback) {
  if (!data || !Array.isArray(data)) return;
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    callback(chunk);
  }
}

function processData(file, data) {
  return new Promise((resolve) => {
    if (!data || !Array.isArray(data)) {
      console.error("Datos no válidos para el archivo:", file);
      resolve([]);
      return;
    }

    const tournamentName = file.split('/').pop().replace('.csv', '').replace(/_/g, ' ');
    
    if (!tournamentStats[tournamentName]) {
      tournamentStats[tournamentName] = {
        totalAssists: 0,
        totalKeyPasses: 0,
        players: new Set(),
        teams: new Set()
      };
    }

    const localPlayerStats = {};
    const validRows = data.filter(row => row && row["Name"] && row["Team"]);

    processInChunks(validRows, 100, (chunk) => {
      chunk.forEach(row => {
        try {
          const name = cleanName(row["Name"]);
          const team = row["Team"].trim();
          
          if (!name || !team) return;

          const matches = parseInt(row["PM"]) || 0;
          const assists = parseInt(row["Assist"]) || 0;
          const keyPasses = parseInt(row["KeyP"]) || 0;

          tournamentStats[tournamentName].totalAssists += assists;
          tournamentStats[tournamentName].totalKeyPasses += keyPasses;
          tournamentStats[tournamentName].players.add(name);
          tournamentStats[tournamentName].teams.add(team);

          if (!localPlayerStats[name]) {
            localPlayerStats[name] = {
              name: row["Name"].trim(),
              teams: new Set(),
              matches: 0,
              assists: 0,
              keyPasses: 0,
              timeline: []
            };
          }

          localPlayerStats[name].teams.add(team);
          localPlayerStats[name].matches += matches;
          localPlayerStats[name].assists += assists;
          localPlayerStats[name].keyPasses += keyPasses;
          localPlayerStats[name].timeline.push({
            torneo: tournamentName,
            matches: matches,
            assists: assists,
            keyPasses: keyPasses
          });
        } catch (error) {
          console.error("Error procesando fila:", row, error);
        }
      });
    });

    resolve(Object.values(localPlayerStats));
  });
}

function explainPlayer(p) {
  if (!p || !p.name) return '<div>Datos del jugador no disponibles</div>';
  
  const totalMatches = p.matches || 1;
  const teams = Array.from(p.teams || []).join(", ");

  let html = `<div style="max-width: 500px;">`;
  html += `<strong>${p.name}</strong><br>`;
  if (teams) html += `<strong>Equipos:</strong> ${teams}<br>`;
  html += `<strong>Partidos jugados:</strong> ${p.matches || 0}<br>`;
  html += `<strong>Asistencias:</strong> ${p.assists || 0} (${((p.assists || 0)/totalMatches).toFixed(2)} por partido)<br>`;
  html += `<strong>Pases clave:</strong> ${p.keyPasses || 0} (${((p.keyPasses || 0)/totalMatches).toFixed(2)} por partido)<br>`;
  
  if (p.timeline?.length > 1) {
    html += `<br><u>Rendimiento por torneo:</u><br>`;
    p.timeline.forEach(t => {
      html += `• ${t.torneo}: ${t.assists || 0} asistencias, ${t.keyPasses || 0} pases clave (${t.matches || 0} partidos)<br>`;
    });
  }

  html += `</div>`;
  return html;
}

function drawBasicCharts(players) {
  const categories = [
    { key: 'assists', label: 'Asistencias', color: '#60A5FA' },
    { key: 'keyPasses', label: 'Pases Clave', color: '#F59E0B' },
    { key: 'matches', label: 'Partidos Jugados', color: '#10B981' }
  ];

  categories.forEach(cat => {
    const top = [...players].filter(p => p[cat.key] > 0)
      .sort((a, b) => b[cat.key] - a[cat.key])
      .slice(0, 10);
    
    const chartDiv = document.createElement("div");
    chartDiv.className = "bg-white rounded shadow p-4";
    chartDiv.style.height = "400px";
    document.getElementById("dashboard").appendChild(chartDiv);
    
    const chart = echarts.init(chartDiv);
    chart.setOption({
      title: { text: `Top 10 - ${cat.label}`, left: 'center' },
      tooltip: {
        formatter: params => {
          const player = players.find(p => p.name === params.name);
          return explainPlayer(player);
        }
      },
      xAxis: {
        type: 'category',
        data: top.map(p => p.name),
        axisLabel: { rotate: 30 }
      },
      yAxis: { type: 'value' },
      series: [{
        data: top.map(p => p[cat.key]),
        type: 'bar',
        itemStyle: { color: cat.color }
      }]
    });
  });

  const scatterDiv = document.createElement("div");
  scatterDiv.className = "bg-white rounded shadow p-4 col-span-2";
  scatterDiv.style.height = "500px";
  document.getElementById("dashboard").appendChild(scatterDiv);

  const scatterChart = echarts.init(scatterDiv);
  scatterChart.setOption({
    title: { text: 'Correlación entre Asistencias y Pases Clave', left: 'center' },
    tooltip: {
      formatter: params => {
        const player = players.find(p => p.name === params.data[2]);
        return explainPlayer(player);
      }
    },
    xAxis: { name: 'Asistencias', type: 'value' },
    yAxis: { name: 'Pases Clave', type: 'value' },
    series: [{
      data: players.map(p => [p.assists, p.keyPasses, p.name]),
      type: 'scatter',
      symbolSize: function(data) {
        return Math.sqrt(data[0] + data[1]) * 2;
      },
      itemStyle: {
        color: function(params) {
          const ratio = params.data[1] / (params.data[0] || 1);
          return ratio > 2 ? '#FF6384' : ratio > 1 ? '#36A2EB' : '#FFCE56';
        }
      }
    }]
  });
}

async function runAdvancedML(players) {
  const tfDiv = document.createElement("div");
  tfDiv.className = "bg-white rounded shadow p-4 col-span-2";
  tfDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Predicción de Rendimiento en Pases</h3>';
  document.getElementById("dashboard").appendChild(tfDiv);

  try {
    await tf.ready();
    const filteredPlayers = players.filter(p => p.matches > 0);
    const maxMatches = Math.max(...filteredPlayers.map(p => p.matches));
    const maxAssists = Math.max(...filteredPlayers.map(p => p.assists));
    const maxKeyPasses = Math.max(...filteredPlayers.map(p => p.keyPasses));

    const features = filteredPlayers.map(p => [
      p.matches / maxMatches,
      p.assists / maxAssists,
      p.keyPasses / maxKeyPasses
    ]);
    
    const labels = filteredPlayers.map(p => [
      (p.assists * 0.7 + p.keyPasses * 0.3) / Math.max(p.matches, 1)
    ]);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);
    
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [3] }));
    model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

    await model.fit(xs, ys, { epochs: 20, batchSize: 8 });
    
    const topPlayers = [...filteredPlayers]
      .sort((a, b) => (b.assists + b.keyPasses) - (a.assists + a.keyPasses))
      .slice(0, 5);

    topPlayers.forEach(p => {
      const input = tf.tensor2d([[
        p.matches / maxMatches,
        p.assists / maxAssists,
        p.keyPasses / maxKeyPasses
      ]]);
      
      const prediction = model.predict(input).dataSync()[0] * 100;
      
      let interpretation = "";
      if (prediction >= 80) interpretation = "🎯 Asistente excepcional";
      else if (prediction >= 60) interpretation = "👌 Excelente creador de juego";
      else if (prediction >= 40) interpretation = "⚽ Buen pasador";
      else if (prediction >= 20) interpretation = "🔄 Jugador promedio";
      else interpretation = "⚠️ Poco contribuyente en pases";

      const predictionElement = document.createElement("div");
      predictionElement.className = "mb-2 p-2 bg-blue-50 rounded";
      predictionElement.innerHTML = `
        <p><strong>${p.name}</strong>: Puntuación de creación ${prediction.toFixed(1)}/100</p>
        <p class="text-sm text-gray-700">${interpretation}</p>
      `;
      tfDiv.appendChild(predictionElement);
    });
  } catch (error) {
    console.error("Error en TensorFlow:", error);
    tfDiv.innerHTML += '<p class="text-red-500">Error al procesar el modelo predictivo</p>';
  }

  const explanationDiv = document.createElement("div");
  explanationDiv.className = "mt-4 p-4 bg-gray-50 rounded";
  explanationDiv.innerHTML = `
    <p class="text-sm text-gray-600 mb-2">El modelo considera:</p>
    <ul class="text-sm text-gray-600 list-disc pl-5">
      <li>Asistencias (70% de peso)</li>
      <li>Pases clave (30% de peso)</li>
      <li>Partidos jugados (para normalizar)</li>
    </ul>
  `;
  tfDiv.appendChild(explanationDiv);
}

function clusterPlayers(players) {
  const clusterDiv = document.createElement("div");
  clusterDiv.className = "bg-white rounded shadow p-4 col-span-2";
  clusterDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Agrupación de Jugadores por Estilo de Pase</h3>';
  document.getElementById("dashboard").appendChild(clusterDiv);

  try {
    const data = players
      .filter(p => p.assists + p.keyPasses > 0)
      .map(p => ({
        name: p.name,
        features: [
          p.assists / Math.max(p.matches, 1), 
          p.keyPasses / Math.max(p.matches, 1), 
          p.assists / (p.assists + p.keyPasses || 1) 
        ],
        total: p.assists + p.keyPasses
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
      
      const avgAssists = players.reduce((sum, p) => sum + p.features[0], 0) / players.length;
      const avgKeyPasses = players.reduce((sum, p) => sum + p.features[1], 0) / players.length;
      const avgRatio = players.reduce((sum, p) => sum + p.features[2], 0) / players.length;

      let clusterType = "";
      if (avgRatio > 0.6) clusterType = "Asistentes puros";
      else if (avgRatio > 0.4) clusterType = "Creadores equilibrados";
      else clusterType = "Generadores de juego (más pases clave)";

      clusterElement.innerHTML = `
        <h4 class="font-semibold mb-2">Grupo ${parseInt(cluster) + 1}: ${clusterType} (${players.length} jugadores)</h4>
        <div class="text-xs mb-2 p-2 bg-white rounded">
          <p><strong>Promedio por partido:</strong></p>
          <p>Asistencias: ${avgAssists.toFixed(2)}</p>
          <p>Pases clave: ${avgKeyPasses.toFixed(2)}</p>
          <p>Ratio asistencias: ${(avgRatio * 100).toFixed(1)}%</p>
        </div>
      `;

      const topPlayers = [...players].sort((a, b) => b.total - a.total).slice(0, 5);
      topPlayers.forEach(p => {
        const playerElement = document.createElement("div");
        playerElement.className = "text-sm mb-1";
        playerElement.textContent = `${p.name}: ${p.total} contribuciones (${p.features[0].toFixed(2)} A, ${p.features[1].toFixed(2)} PC)`;
        clusterElement.appendChild(playerElement);
      });

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
  storyDiv.innerHTML = '<h3 class="text-lg font-semibold mb-2">Análisis de Pases en la Kings League</h3>';
  document.getElementById("dashboard").appendChild(storyDiv);

  const topAssisters = [...players].sort((a, b) => b.assists - a.assists).slice(0, 3);
  const topCreators = [...players].sort((a, b) => (b.assists + b.keyPasses) - (a.assists + a.keyPasses)).slice(0, 3);
  const topTournament = Object.entries(tournaments).sort((a, b) => b[1].totalKeyPasses - a[1].totalKeyPasses)[0];

  let story = `<div class="prose max-w-none">`;
  
  story += `<h4 class="font-semibold text-blue-800">Resumen de la Temporada</h4>`;
  story += `<p>En un emocionante torneo que contó con ${Object.keys(tournaments).length} competiciones distintas, `;
  story += `los jugadores demostraron su visión de juego con un total de ${Object.values(tournaments).reduce((sum, t) => sum + t.totalAssists, 0)} asistencias y `;
  story += `${Object.values(tournaments).reduce((sum, t) => sum + t.totalKeyPasses, 0)} pases clave. `;
  story += `El torneo con más creatividad fue <strong>${topTournament[0]}</strong> con ${topTournament[1].totalKeyPasses} pases clave.</p>`;
  
  story += `<h4 class="font-semibold text-blue-800 mt-4">Los Mejores Asistentes</h4>`;
  topAssisters.forEach((p, i) => {
    story += `<p>${i+1}. <strong>${p.name}</strong> lidera la tabla con ${p.assists} asistencias (${(p.assists/p.matches).toFixed(2)} por partido) `;
    story += `y ${p.keyPasses} pases clave. Un rendimiento destacado con ${Array.from(p.teams).join(" y ")}.</p>`;
  });
  
  story += `<h4 class="font-semibold text-blue-800 mt-4">Los Creadores de Juego Más Completos</h4>`;
  topCreators.forEach((p, i) => {
    story += `<p>${i+1}. <strong>${p.name}</strong> con ${p.assists + p.keyPasses} contribuciones ofensivas `;
    story += `(${p.assists} asistencias + ${p.keyPasses} pases clave). `;
    story += `Un jugador clave para desequilibrar defensas.</p>`;
  });
  
  story += `<h4 class="font-semibold text-blue-800 mt-4">Estadísticas Destacadas</h4>`;
  story += `<ul class="list-disc pl-5">`;
  story += `<li>Total de jugadores con al menos 1 asistencia: ${players.filter(p => p.assists > 0).length}</li>`;
  story += `<li>Jugadores con más de 5 pases clave por partido: ${players.filter(p => p.keyPasses/p.matches > 5).length}</li>`;
  story += `<li>Ratio asistencias por pases clave: ${(Object.values(tournaments).reduce((sum, t) => sum + t.totalAssists, 0) / Object.values(tournaments).reduce((sum, t) => sum + t.totalKeyPasses, 1)).toFixed(2)}</li>`;
  story += `</ul>`;      
  story += `</div>`;
  
  storyDiv.innerHTML += story;
}

function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 col-span-2";
  errorDiv.innerHTML = `
    <p class="font-bold">Error</p>
    <p>${message}</p>
  `;
  document.getElementById("dashboard").appendChild(errorDiv);
}

let isLoading = false;
  
function loadYear(year) {
  if (isLoading) return;
  
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("dashboard").innerHTML = '';
  isLoading = true;

  Object.keys(playerStats).forEach(key => delete playerStats[key]);
  Object.keys(tournamentStats).forEach(key => delete tournamentStats[key]);

  const files = fileSets[year];
  if (!files || files.length === 0) {
    console.error("No hay archivos para el año seleccionado:", year);
    showError("No se encontraron datos para la temporada seleccionada");
    document.getElementById("loading").classList.add("hidden");
    isLoading = false;
    return;
  }

  document.getElementById("fileCount").textContent = `0/${files.length} archivos`;
  document.getElementById("progressBar").style.width = '0%';
  document.getElementById("progressText").textContent = '0%';

  const promises = files.map((file, index) => 
    new Promise((resolve) => {
      Papa.parse(file, {
        download: true,
        header: true,
        complete: (results) => {
          try {
            document.getElementById("fileCount").textContent = `${index + 1}/${files.length} archivos`;
            document.getElementById("progressBar").style.width = `${((index + 1) / files.length) * 100}%`;
            document.getElementById("progressText").textContent = `${Math.round(((index + 1) / files.length) * 100)}%`;
            
            processData(file, results.data)
              .then(resolve)
              .catch(error => {
                console.error(`Error procesando archivo ${file}:`, error);
                resolve([]); 
              });
          } catch (error) {
            console.error(`Error en complete callback para ${file}:`, error);
            resolve([]);
          }
        },
        error: (error) => {
          console.error(`Error al parsear ${file}:`, error);
          resolve([]);
        }
      });
    })
  );

  Promise.all(promises)
    .then(results => {
      try {
        const allPlayers = results.flat();
        const mergedPlayers = {};

        allPlayers.forEach(player => {
          if (!player?.name) return;
          
          const name = cleanName(player.name);
          if (!name) return;

          if (!mergedPlayers[name]) {
            mergedPlayers[name] = {
              ...player,
              teams: new Set(player.teams || []),
              timeline: [...(player.timeline || [])]
            };
          } else {
            mergedPlayers[name].matches += player.matches || 0;
            mergedPlayers[name].assists += player.assists || 0;
            mergedPlayers[name].keyPasses += player.keyPasses || 0;
            (player.teams || []).forEach(t => mergedPlayers[name].teams.add(t));
            (player.timeline || []).forEach(t => mergedPlayers[name].timeline.push(t));
          }
        });

        const playersArray = Object.values(mergedPlayers).map(p => ({
          ...p,
          team: Array.from(p.teams || []).join(", ")
        }));

        if (playersArray.length > 0) {
          drawBasicCharts(playersArray);
          runAdvancedML(playersArray);
          clusterPlayers(playersArray);
          generateStorytelling(playersArray, tournamentStats);
        } else {
          showError("No se encontraron datos válidos para mostrar");
        }
      } catch (error) {
        console.error("Error al procesar resultados:", error);
        showError("Error al procesar los datos");
      } finally {
        document.getElementById("loading").classList.add("hidden");
        isLoading = false;
      }
    })
    .catch(error => {
      console.error("Error en Promise.all:", error);
      showError("Error al cargar los datos");
      document.getElementById("loading").classList.add("hidden");
      isLoading = false;
    });
}

document.addEventListener("DOMContentLoaded", function() {
  if (fileSets && fileSets['2023']) {
    loadYear('2023');
  } else {
    showError("No se pudieron cargar los archivos de datos");
  }
});