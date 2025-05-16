import { DecisionTreeRegression } from 'https://cdn.jsdelivr.net/npm/ml-cart@2.1.1/+esm';
import KNN from 'https://cdn.jsdelivr.net/npm/ml-knn@3.0.0/+esm';
import { Matrix } from 'https://cdn.jsdelivr.net/npm/ml-matrix@6.8.0/+esm';
import { pseudoInverse } from 'https://cdn.jsdelivr.net/npm/ml-matrix@6.8.0/+esm';
import Papa from 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm';


const container = document.getElementById('carouselContainer');
const scrollLeftBtn = document.getElementById('scrollLeft');
const scrollRightBtn = document.getElementById('scrollRight');
const cardWidth = 250 + 16;

scrollLeftBtn.addEventListener('click', () => {
    container.scrollBy({ left: -cardWidth * 2, behavior: 'smooth' });
});

scrollRightBtn.addEventListener('click', () => {
    container.scrollBy({ left: cardWidth * 2, behavior: 'smooth' });
});

const fileSets = {
    "2023": [
        "./json/2023_2024/goals/1_split_kings.csv",
        "./json/2023_2024/goals/2_split_kings.csv",
        "./json/2023_2024/goals/3_split_kings.csv",
        "./json/2023_2024/goals/kings_cup.csv",
        "./json/2023_2024/goals/kingdom_cup.csv"
    ],
    "2024": [
        "./json/2024_2025/goals/4_split_kings.csv",
        "./json/2024_2025/goals/5_split_kings.csv"
    ]
};

const splitsByYear = {
    "2023": [
        { name: "1er Split", file: "1_split_kings" },
        { name: "2º Split", file: "2_split_kings" },
        { name: "3er Split", file: "3_split_kings" },
        { name: "Kings Cup", file: "kings_cup" },
        { name: "Kingdom Cup", file: "kingdom_cup" }
    ],
    "2024": [
        { name: "4º Split", file: "4_split_kings" },
        { name: "5º Split", file: "5_split_kings" }
    ]
};

const TEAM_NAMES = {
    ANI: "ANIQUILADORES FC",
    JFC: "JIJANTES FC",
    KNS: "KUNISPORTS",
    POR: "PORCINOS FC",
    SAI: "SAIYANS FC",
    ULT: "ULTIMATE MÓSTOLES",
    XBU: "XBUYER TEAM"
};

const MODEL_COLORS = {
    real: '#2c3e50',
    tree: '#e74c3c',
    knn: '#3498db',
    linear: '#2ecc71'
};

const parseCSV = (url) =>
    new Promise((resolve) => {
    Papa.parse(url, {
        download: true,
        header: true,
        complete: (results) => {
        if (results.errors.length > 0) {
            console.error("Errores al parsear CSV:", results.errors);
        }
        resolve(results.data.filter(row => row.PM && (row.TG || row.G)));
        }
    });
    });

const loadData = async (yearFilter, splitFilter = "all") => {
    let data = [];
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'none';

    try {
    for (const year of Object.keys(fileSets)) {
        if (yearFilter !== "all" && year !== yearFilter) continue;

        for (const file of fileSets[year]) {
        if (splitFilter !== "all" && !file.includes(splitFilter)) continue;

        const rows = await parseCSV(file);
        const isSplit = file.includes("split");

        const parsed = rows
            .filter(r => r.PM && (r.TG || r.G))
            .map(r => {
            const pm = parseFloat(r.PM) || 0;
            const goals = isSplit ? (parseFloat(r.TG) || 0) : (parseFloat(r.G)) || 0;
            const features = isSplit
                ? [
                    pm, 
                    parseFloat(r.Pen) || 0, 
                    parseFloat(r.PSO) || 0, 
                    parseFloat(r.OW) || 0
                ]
                : [pm, 0, 0, 0];

            let rawTeam = (r.Team || "Desconocido").trim().toUpperCase();
            let team = TEAM_NAMES[rawTeam] || rawTeam;
            const splitName = getSplitNameFromFile(file);

            return { 
                features, 
                label: goals, 
                name: r.Name, 
                team,
                year,
                split: splitName
            };
            });

        data = data.concat(parsed);
        }
    }

    if (data.length === 0) {
        throw new Error("No se encontraron datos válidos para los filtros seleccionados");
    }

    return data;
    } catch (error) {
        console.error("Error al cargar datos:", error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
        return [];
    }
};

const getSplitNameFromFile = (file) => {
    for (const year of Object.keys(splitsByYear)) {
        for (const split of splitsByYear[year]) {
            if (file.includes(split.file)) {
            return split.name;
            }
        }
    }
    return "Desconocido";
};

const updateStats = (data) => {
    document.getElementById('playerCount').textContent = data.length;
    const totalGoals = data.reduce((sum, d) => sum + d.label, 0);
    document.getElementById('totalGoals').textContent = totalGoals;
};

const trainModels = async (X, y, selectedModels) => {
    const predictions = {};
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'none';
    
    document.getElementById('loading').style.display = 'block';
    
    try {
    if (X.length === 0 || y.length === 0) {
        throw new Error("Datos de entrenamiento vacíos");
    }
    const allNumeric = X.every(row => row.every(val => !isNaN(val))) && 
                        y.every(val => !isNaN(val));
    
    if (!allNumeric) {
        throw new Error("Los datos contienen valores no numéricos");
    }

    if (selectedModels.includes('tree')) {
        try {
        const tree = new DecisionTreeRegression({ maxDepth: 5 });
        tree.train(X, y);
        predictions.tree = X.map(x => tree.predict([x])[0]);
        } catch (error) {
        console.error("Error en Árbol de Decisión:", error);
        }
    }
    
    if (selectedModels.includes('knn')) {
        try {
        const k = Math.min(3, X.length - 1);
        const knn = new KNN(X, y, { k: k > 0 ? k : 1 });
        predictions.knn = X.map(x => knn.predict(x));
        } catch (error) {
        console.error("Error en KNN:", error);
        }
    }
    
    if (selectedModels.includes('linear')) {
        try {
        const XWithBias = X.map(row => [1, ...row]);
        const Xm = new Matrix(XWithBias);
        const ym = Matrix.columnVector(y);
        const XtX = Xm.transpose().mmul(Xm);
        
        for (let i = 0; i < XtX.rows; i++) {
            XtX.set(i, i, XtX.get(i, i) + 1e-10);
        }
        
        const XtY = Xm.transpose().mmul(ym);
        const XtXInv = pseudoInverse(XtX);
        const theta = XtXInv.mmul(XtY).getColumn(0);
        
        predictions.linear = XWithBias.map(x => {
            return x.reduce((sum, val, i) => sum + val * theta[i], 0);
        });
        } catch (error) {
        console.error("Error en Regresión Lineal:", error);
        }
    }
    } catch (error) {
    console.error("Error al entrenar modelos:", error);
    errorDiv.textContent = `Error al entrenar modelos: ${error.message}`;
    errorDiv.style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
    return predictions;
};

let currentChart = null;

const renderChart = async (data, selectedModels) => {
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'none';
    
    if (data.length === 0) {
    errorDiv.textContent = "No hay datos para mostrar con los filtros seleccionados";
    errorDiv.style.display = 'block';
    echarts.init(document.getElementById('main')).dispose();
    document.getElementById('conclusions-content').innerHTML = 
        '<p>No hay datos suficientes para generar conclusiones con estos filtros.</p>';
    return;
    }

    try {
    const X = data.map(d => d.features);
    const y = data.map(d => d.label);

    updateStats(data);

    const predictions = await trainModels(X, y, selectedModels);

    const chartDom = document.getElementById('main');
    if (currentChart) {
        currentChart.dispose();
    }
    currentChart = echarts.init(chartDom);
    
    const series = [
        { 
        name: 'Goles Reales', 
        type: 'bar', 
        data: y, 
        itemStyle: { 
            color: MODEL_COLORS.real,
            borderRadius: [4, 4, 0, 0]
        }, 
        barWidth: '60%',
        barCategoryGap: '40%'
        }
    ];
    
    if (selectedModels.includes('tree') && predictions.tree) {
        series.push({
        name: 'Árbol de Decisión',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
            width: 3,
            type: 'solid'
        },
        data: predictions.tree,
        itemStyle: { color: MODEL_COLORS.tree }
        });
    }
    
    if (selectedModels.includes('knn') && predictions.knn) {
        series.push({
        name: 'K-Nearest Neighbors',
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 8,
        lineStyle: {
            width: 3,
            type: 'dashed'
        },
        data: predictions.knn,
        itemStyle: { color: MODEL_COLORS.knn }
        });
    }
    
    if (selectedModels.includes('linear') && predictions.linear) {
        series.push({
        name: 'Regresión Lineal',
        type: 'line',
        smooth: true,
        symbol: 'triangle',
        symbolSize: 8,
        lineStyle: {
            width: 3,
            type: 'dotted'
        },
        data: predictions.linear,
        itemStyle: { color: MODEL_COLORS.linear }
        });
    }
    
    if (series.length <= 1) {
        throw new Error("No se pudo entrenar ningún modelo con los datos proporcionados");
    }

    const option = {
        title: { 
        text: 'Predicción de Goles - Comparativa de Modelos', 
        left: 'center',
        textStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#2c3e50'
        }
        },
        tooltip: {
        trigger: 'axis',
        axisPointer: { 
            type: 'shadow',
            shadowStyle: {
            color: 'rgba(150, 150, 150, 0.1)'
            }
        },
        formatter: function (params) {
            const dataPoint = data[params[0].dataIndex];
            let tooltip = `<div style="font-weight:bold;margin-bottom:5px">${dataPoint.name}</div>`;
            tooltip += `<div style="display:flex;justify-content:space-between"><span>Equipo:</span><span style="font-weight:bold">${dataPoint.team}</span></div>`;
            tooltip += `<div style="display:flex;justify-content:space-between"><span>Año/Split:</span><span>${dataPoint.year} - ${dataPoint.split}</span></div>`;
            tooltip += `<div style="display:flex;justify-content:space-between"><span>Partidos:</span><span>${dataPoint.features[0]}</span></div>`;
            tooltip += `<div style="border-top:1px solid #eee;margin:5px 0;padding-top:5px;display:flex;justify-content:space-between">
                        <span style="font-weight:bold">Goles reales:</span>
                        <span style="font-weight:bold">${dataPoint.label.toFixed(2)}</span>
                        </div>`;
            
            params.slice(1).forEach(p => {
            tooltip += `<div style="display:flex;justify-content:space-between">
                            <span>${p.seriesName}:</span>
                            <span style="font-weight:bold">${p.data.toFixed(2)}</span>
                        </div>`;
            });
            
            return tooltip;
        }
        },
        legend: { 
        top: 40, 
        data: series.map(s => s.name),
        selected: Object.fromEntries(series.map(s => [s.name, true])),
        textStyle: {
            fontSize: 12
        }
        },
        grid: { 
            top: 100, 
            bottom: 80, 
            left: 60, 
            right: 40,
            containLabel: true
        },
        xAxis: {
        type: 'category',
        data: data.map((d, i) => `${d.name.split(' ')[0]} (${i + 1})`),
        axisLabel: { 
            rotate: 30,
            fontSize: 10,
            interval: 0
        },
        axisLine: {
            lineStyle: {
            color: '#ccc'
            }
        },
        axisTick: {
            alignWithLabel: true
        }
        },
        yAxis: {
        type: 'value',
        name: 'Goles',
        nameLocation: 'middle',
        nameGap: 40,
        axisLine: {
            lineStyle: {
            color: '#ccc'
            }
        },
        splitLine: {
            lineStyle: {
            type: 'dashed'
            }
        }
        },
        dataZoom: [
        {
            type: 'slider',
            show: true,
            xAxisIndex: [0],
            start: 0,
            end: data.length > 20 ? 20 / data.length * 100 : 100,
            height: 20,
            bottom: 30,
            handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
            handleSize: '80%',
            handleStyle: {
            color: '#fff',
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.6)',
            shadowOffsetX: 2,
            shadowOffsetY: 2
            }
        },
        {
            type: 'inside',
            xAxisIndex: [0],
            zoomOnMouseWheel: false,
            moveOnMouseMove: true,
            moveOnMouseWheel: true
        }
        ],
        series: series
    };

    currentChart.setOption(option);
    generateConclusions(data, predictions, selectedModels);

    document.getElementById('zoomInBtn').addEventListener('click', () => {
        const option = currentChart.getOption();
        const dataZoom = option.dataZoom[0];
        const range = dataZoom.end - dataZoom.start;
        const newRange = Math.max(10, range * 0.8); 
        const center = (dataZoom.start + dataZoom.end) / 2;
        const newStart = Math.max(0, center - newRange / 2);
        const newEnd = Math.min(100, center + newRange / 2);
        
        currentChart.dispatchAction({
        type: 'dataZoom',
        start: newStart,
        end: newEnd
        });
    });

    document.getElementById('zoomOutBtn').addEventListener('click', () => {
        const option = currentChart.getOption();
        const dataZoom = option.dataZoom[0];
        const range = dataZoom.end - dataZoom.start;
        const newRange = Math.min(100, range * 1.2);
        const center = (dataZoom.start + dataZoom.end) / 2;
        const newStart = Math.max(0, center - newRange / 2);
        const newEnd = Math.min(100, center + newRange / 2);
        
        currentChart.dispatchAction({
        type: 'dataZoom',
        start: newStart,
        end: newEnd
        });
    });

    document.getElementById('resetZoomBtn').addEventListener('click', () => {
        currentChart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: data.length > 20 ? 20 / data.length * 100 : 100
        });
    });

    document.getElementById('panLeftBtn').addEventListener('click', () => {
        const option = currentChart.getOption();
        const dataZoom = option.dataZoom[0];
        const range = dataZoom.end - dataZoom.start;
        const moveAmount = Math.min(10, range * 0.2);
        const newStart = Math.max(0, dataZoom.start - moveAmount);
        const newEnd = newStart + range;
        
        currentChart.dispatchAction({
        type: 'dataZoom',
        start: newStart,
        end: newEnd
        });
    });

    document.getElementById('panRightBtn').addEventListener('click', () => {
        const option = currentChart.getOption();
        const dataZoom = option.dataZoom[0];
        const range = dataZoom.end - dataZoom.start;
        const moveAmount = Math.min(10, range * 0.2);
        const newEnd = Math.min(100, dataZoom.end + moveAmount);
        const newStart = newEnd - range;
        
        currentChart.dispatchAction({
        type: 'dataZoom',
        start: newStart,
        end: newEnd
        });
    });

    chartDom.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        
        if (e.ctrlKey || e.metaKey) {
        const option = currentChart.getOption();
        const dataZoom = option.dataZoom[0];
        const range = dataZoom.end - dataZoom.start;
        const newRange = Math.max(10, Math.min(100, range * (delta > 0 ? 0.9 : 1.1)));
        const center = (dataZoom.start + dataZoom.end) / 2;
        const newStart = Math.max(0, center - newRange / 2);
        const newEnd = Math.min(100, center + newRange / 2);
        
        currentChart.dispatchAction({
            type: 'dataZoom',
            start: newStart,
            end: newEnd
        });
        } else {
            const option = currentChart.getOption();
            const dataZoom = option.dataZoom[0];
            const range = dataZoom.end - dataZoom.start;
            const moveAmount = Math.min(5, range * 0.1) * delta;
            const newStart = Math.max(0, dataZoom.start + moveAmount);
            const newEnd = Math.min(100, dataZoom.end + moveAmount);
            
            currentChart.dispatchAction({
                type: 'dataZoom',
                start: newStart,
                end: newEnd
            });
        }
    });

    window.addEventListener('resize', () => currentChart.resize());
    } catch (error) {
        console.error("Error al renderizar gráfico:", error);
        errorDiv.textContent = `Error al mostrar gráfico: ${error.message}`;
        errorDiv.style.display = 'block';
    }
};


const generateConclusions = (data, predictions, selectedModels) => {
    const conclusionsContainer = document.getElementById('conclusions-content');
    
    if (!selectedModels || selectedModels.length === 0) {
    conclusionsContainer.innerHTML = '<p>Selecciona al menos un modelo para ver conclusiones.</p>';
    return;
    }

    const realGoals = data.map(d => d.label);
    const avgRealGoals = (realGoals.reduce((a, b) => a + b, 0) / realGoals.length).toFixed(2);
    
    let conclusionsHTML = `
    <div class="conclusion-item">
        Se analizaron <strong>${data.length} jugadores</strong> con un promedio de 
        <strong>${avgRealGoals} goles</strong> por jugador.
    </div>
    `;
    
    if (selectedModels.includes('tree') && predictions.tree) {
    const treeErrors = predictions.tree.map((p, i) => Math.abs(p - realGoals[i]));
    const treeAvgError = (treeErrors.reduce((a, b) => a + b, 0) / treeErrors.length).toFixed(2);
    
    conclusionsHTML += `
        <div class="conclusion-item">
        El <span class="model-highlight tree-color">Árbol de Decisión</span> tiene un error promedio de 
        <strong>${treeAvgError} goles</strong> por jugador. 
        ${treeAvgError < 1 ? 'Es muy preciso para identificar patrones clave.' : 'Puede mejorar ajustando sus reglas.'}
        </div>
    `;
    }
    
    if (selectedModels.includes('knn') && predictions.knn) {
    const knnErrors = predictions.knn.map((p, i) => Math.abs(p - realGoals[i]));
    const knnAvgError = (knnErrors.reduce((a, b) => a + b, 0) / knnErrors.length).toFixed(2);
    
    conclusionsHTML += `
        <div class="conclusion-item">
        El modelo <span class="model-highlight knn-color">KNN</span> (comparación con jugadores similares) 
        tiene un error de <strong>${knnAvgError} goles</strong>. 
        ${knnAvgError < 1 ? 'Funciona bien para encontrar jugadores con rendimientos parecidos.' : 'Puede que necesite más datos de jugadores similares.'}
        </div>
    `;
    }
    
    if (selectedModels.includes('linear') && predictions.linear) {
    const linearErrors = predictions.linear.map((p, i) => Math.abs(p - realGoals[i]));
    const linearAvgError = (linearErrors.reduce((a, b) => a + b, 0) / linearErrors.length).toFixed(2);
    
    conclusionsHTML += `
        <div class="conclusion-item">
        La <span class="model-highlight linear-color">Regresión Lineal</span> (relación partidos-goles) 
        tiene un error de <strong>${linearAvgError} goles</strong>.
        ${linearAvgError < 1 ? 'Muestra una relación clara entre partidos jugados y goles.' : 'La relación no es totalmente lineal, otros factores influyen.'}
        </div>
    `;
    }
    
    if (selectedModels.length > 1) {
        conclusionsHTML += `
            <div class="conclusion-item" style="margin-top: 15px; font-weight: 500;">
            💡 <strong>Recomendación:</strong> ${
                predictions.tree && predictions.linear && 
                Math.abs(predictions.tree[0] - predictions.linear[0]) > 1.5 ?
                'Los modelos discrepan significativamente. Revisa jugadores con mucho tiempo de juego pero pocos goles.' :
                'Los modelos coinciden en sus predicciones. Los patrones son consistentes.'
            }
            </div>
        `;
    }
    
    if (data.length > 0) {
        const topPlayer = data[0];
        console.log("Conclusions HTML:", topPlayer.features[0]/topPlayer.label,"sss");
        console.log(topPlayer);
        conclusionsHTML += `
            <div class="conclusion-item" style="margin-top: 15px;">
            <strong>Ejemplo práctico:</strong> ${topPlayer.name} (${topPlayer.team}) marcó 
            ${topPlayer.label} goles en ${topPlayer.features[0]} partidos. 
            ${Math.round(topPlayer.features[0]/topPlayer.label) <= 2 ? 
                'Es muy eficiente (marca cada ' + Math.round(topPlayer.features[0]/topPlayer.label) + ' partido/os).' : 
                'Juega muchos partidos para su producción de goles.'}
            </div>
        `;
    }    
    conclusionsContainer.innerHTML = conclusionsHTML;
};

const updateTeamSelector = (data) => {
    const select = document.getElementById('teamSelector');
    const previousValue = select.value;

    const allTeams = [...new Set(data.map(d => d.team))].sort();

    select.innerHTML = `<option value="all">Todos los equipos</option>` +
    allTeams.map(t => `<option value="${t}">${t}</option>`).join('');

    if (previousValue && (previousValue === "all" || allTeams.includes(previousValue))) {
    select.value = previousValue;
    } else {
    select.value = "all";
    }
};

const updateSplitSelector = (year) => {
    const select = document.getElementById('splitSelector');
    const previousValue = select.value;
    
    select.innerHTML = `<option value="all">Todos los splits</option>`;
    
    if (year !== "all" && splitsByYear[year]) {
    select.innerHTML += splitsByYear[year]
        .map(s => `<option value="${s.file}">${s.name}</option>`)
        .join('');
    }

    if (previousValue && select.querySelector(`option[value="${previousValue}"]`)) {
    select.value = previousValue;
    }
};

const getSelectedModels = () => {
    const checkboxes = document.querySelectorAll('.model-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
};

let currentData = [];
let currentYear = "all";
let currentSplit = "all";
let currentTeam = "all";

const filterData = () => {
    let filtered = [...currentData];
    
    if (currentYear !== "all") {
    filtered = filtered.filter(d => d.year === currentYear);
    }
    
    if (currentSplit !== "all") {
    const splitFile = splitsByYear[currentYear]?.find(s => s.file === currentSplit)?.name;
    if (splitFile) {
        filtered = filtered.filter(d => d.split === splitFile);
    }
    }
    
    if (currentTeam !== "all") {
    filtered = filtered.filter(d => d.team === currentTeam);
    }
    
    const grouped = new Map();
    for (const d of filtered) {
    const key = `${d.name}-${d.team}`;
    if (!grouped.has(key)) {
        grouped.set(key, { ...d });
    } else {
        const existing = grouped.get(key);
        for (let i = 0; i < existing.features.length; i++) {
        existing.features[i] += d.features[i];
        }
        existing.label += d.label;
    }
    }
    
    return Array.from(grouped.values()).sort((a, b) => b.label - a.label);
};

const updateAndRender = async () => {
    currentData = await loadData(currentYear, currentSplit);
    const filteredData = filterData();
    updateTeamSelector(currentData);
    await renderChart(filteredData, getSelectedModels());
};

const main = async () => {
    await updateAndRender();

    document.getElementById('yearSelector').addEventListener('change', async (e) => {
    currentYear = e.target.value;
    currentSplit = "all"; 
    updateSplitSelector(currentYear);
    await updateAndRender();
    });

    document.getElementById('splitSelector').addEventListener('change', async (e) => {
    currentSplit = e.target.value;
    await updateAndRender();
    });

    document.getElementById('teamSelector').addEventListener('change', (e) => {
    currentTeam = e.target.value;
    const filteredData = filterData();
    renderChart(filteredData, getSelectedModels());
    });

    document.querySelectorAll('.model-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const filteredData = filterData();
        renderChart(filteredData, getSelectedModels());
    });
    });
};

main();