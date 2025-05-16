import { translate } from './i18n.js';
// Chart.js wird als globales Objekt geladen
const Chart = window.Chart;

// Registriere benötigte Chart.js Komponenten
Chart.register(
    Chart.DoughnutController,
    Chart.PieController,
    Chart.BarController,
    Chart.LineController,
    Chart.CategoryScale,
    Chart.LinearScale,
    Chart.PointElement,
    Chart.LineElement,
    Chart.ArcElement,
    Chart.BarElement,
    Chart.Legend,
    Chart.Tooltip
);

// Farben für Charts
const chartColors = {
    blue: ['#3b82f6', '#60a5fa', '#93c5fd'],
    green: ['#22c55e', '#4ade80', '#86efac'],
    purple: ['#a855f7', '#c084fc', '#d8b4fe'],
    orange: ['#f97316', '#fb923c', '#fdba74']
};

let charts = {
    quality: null,
    aspectRatio: null,
    user: null,
    costs: null,
    imagesPerDay: null,
    costsPerDay: null,
    refUsage: null,
    avgRef: null,
    refCosts: null,
    batchStats: null,
    imagesPerMonth: null
};

// Chart.js Defaults für dunkles Theme
function updateChartDefaults() {
    const darkMode = document.documentElement.classList.contains('dark');
    Chart.defaults.color = darkMode ? '#94a3b8' : '#475569';
    Chart.defaults.borderColor = darkMode ? '#334155' : '#e2e8f0';
}

export function initStatistics() {
    // Setze Chart.js Defaults
    updateChartDefaults();

    // Aktualisiere Chart Defaults wenn sich der Theme-Modus ändert
    const observer = new MutationObserver(() => {
        updateChartDefaults();
        // Aktualisiere existierende Charts wenn vorhanden
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.update();
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });

    const statsButton = document.getElementById('statsButton');
    const mobileStatsButton = document.getElementById('mobileStatsButton');
    const statsModal = document.getElementById('statsModal');
    const closeStatsModal = document.getElementById('closeStatsModal');

    // Prüfe ob User Admin ist und zeige Button entsprechend
    fetch('php/session_auth.php?action=status')
        .then(res => res.json())
        .then(data => {
            if (data.role === 'admin') {
                statsButton.classList.remove('hidden');
                mobileStatsButton.classList.remove('hidden');
            }
        });

    // Event Listener
    [statsButton, mobileStatsButton].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                statsModal.classList.remove('hidden');
                loadStatistics();
            });
        }
    });

    if (closeStatsModal) {
        closeStatsModal.addEventListener('click', () => {
            statsModal.classList.add('hidden');
        });
    }

    // Schließen mit Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !statsModal.classList.contains('hidden')) {
            statsModal.classList.add('hidden');
        }
    });

    // Klick außerhalb schließt Modal
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) {
            statsModal.classList.add('hidden');
        }
    });
}

async function loadStatistics() {
    try {
        const response = await fetch('php/get_statistics.php');
        const data = await response.json();

        if (data.error) {
            console.error('Error loading statistics:', data.error);
            return;
        }

        // Update Zahlen-Karten
        document.getElementById('totalImages').textContent = data.totalImages;
        document.getElementById('totalCosts').textContent = (data.totalCosts / 100).toFixed(2) + translate('statistics.unit.currency');
        document.getElementById('avgImagesPerDay').textContent = 
            Object.values(data.imagesPerDay).reduce((a, b) => Math.max(a, b), 0) + translate('statistics.card.peakPerDaySuffix');
        document.getElementById('avgCostPerImage').textContent = (data.avgCostPerImage / 100).toFixed(2) + translate('statistics.unit.currency');

        // Update Charts
        updateQualityChart(data.qualityDistribution);
        updateAspectRatioChart(data.aspectRatioDistribution);
        updateUserChart(data.userDistribution);
        updateImagesPerMonthChart(data.imagesPerMonth);
        updateCostsChart(data.costsPerMonth);
        updateImagesPerDayChart(data.imagesPerDay);
        updateCostsPerDayChart(data.costsPerDay);
        
        // Neue Charts
        updateRefUsageChart(data.referenceImageStats);
        updateAvgRefChart(data.referenceImageStats);
        updateRefCostsChart(data.referenceImageStats);
        updateBatchStatsChart(data.batchStats);

    } catch (error) {
        console.error('Error fetching statistics:', error);
    }
}

function updateQualityChart(data) {
    const ctx = document.getElementById('qualityChart');
    if (charts.quality) charts.quality.destroy();
    
    const labels = {
        'low': translate('settings.quality.low'),
        'medium': translate('settings.quality.medium'),
        'high': translate('settings.quality.high')
    };

    charts.quality = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data).map(key => labels[key]),
            datasets: [{
                data: Object.values(data),
                backgroundColor: chartColors.blue,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            }
        }
    });
}

function updateAspectRatioChart(data) {
    const ctx = document.getElementById('aspectRatioChart');
    if (charts.aspectRatio) charts.aspectRatio.destroy();
    
    const labels = {
        '1024x1024': translate('statistics.aspectRatio.squareLabel'),
        '1024x1536': translate('statistics.aspectRatio.portraitLabel'),
        '1536x1024': translate('statistics.aspectRatio.landscapeLabel')
    };

    charts.aspectRatio = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data).map(key => labels[key] || key),
            datasets: [{
                data: Object.values(data),
                backgroundColor: chartColors.green,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            }
        }
    });
}

function updateUserChart(data) {
    const ctx = document.getElementById('userChart');
    if (charts.user) charts.user.destroy();

    charts.user = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: translate('statistics.chartLabel.imageCount'),
                data: Object.values(data),
                backgroundColor: chartColors.purple[0],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateImagesPerMonthChart(data) {
    const ctx = document.getElementById('imagesPerMonthChart');
    if (charts.imagesPerMonth) charts.imagesPerMonth.destroy();

    // Formatiere Monatsnamen
    const monthNames = {
        '01': translate('month.short.jan'), '02': translate('month.short.feb'), '03': translate('month.short.mar'), '04': translate('month.short.apr'),
        '05': translate('month.short.may'), '06': translate('month.short.jun'), '07': translate('month.short.jul'), '08': translate('month.short.aug'),
        '09': translate('month.short.sep'), '10': translate('month.short.oct'), '11': translate('month.short.nov'), '12': translate('month.short.dec')
    };

    const labels = Object.keys(data).map(key => {
        const [year, month] = key.split('-');
        return `${monthNames[month]} ${year}`;
    });

    charts.imagesPerMonth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: translate('statisticsModal.charts.imagesPerMonth'),
                data: Object.values(data),
                borderColor: chartColors.blue[0],
                backgroundColor: chartColors.blue[2] + '40',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateCostsChart(data) {
    const ctx = document.getElementById('costsChart');
    if (charts.costs) charts.costs.destroy();

    // Formatiere Monatsnamen
    const monthNames = {
        '01': translate('month.short.jan'), '02': translate('month.short.feb'), '03': translate('month.short.mar'), '04': translate('month.short.apr'),
        '05': translate('month.short.may'), '06': translate('month.short.jun'), '07': translate('month.short.jul'), '08': translate('month.short.aug'),
        '09': translate('month.short.sep'), '10': translate('month.short.oct'), '11': translate('month.short.nov'), '12': translate('month.short.dec')
    };

    const labels = Object.keys(data).map(key => {
        const [year, month] = key.split('-');
        return `${monthNames[month]} ${year}`;
    });

    charts.costs = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: translate('statistics.chartLabel.costsInCurrency'),
                data: Object.values(data),
                borderColor: chartColors.orange[0],
                backgroundColor: chartColors.orange[2] + '40',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => value.toFixed(2) + translate('statistics.unit.currency')
                    }
                }
            }
        }
    });
}

function updateImagesPerDayChart(data) {
    const ctx = document.getElementById('imagesPerDayChart');
    if (charts.imagesPerDay) charts.imagesPerDay.destroy();

    const labels = Object.keys(data).map(date => {
        const [year, month, day] = date.split('-');
        return `${day}.${month}.`;
    });

    charts.imagesPerDay = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: translate('statisticsModal.charts.imagesPerDay'),
                data: Object.values(data),
                borderColor: chartColors.purple[0],
                backgroundColor: chartColors.purple[2] + '40',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateCostsPerDayChart(data) {
    const ctx = document.getElementById('costsPerDayChart');
    if (charts.costsPerDay) charts.costsPerDay.destroy();

    const labels = Object.keys(data).map(date => {
        const [year, month, day] = date.split('-');
        return `${day}.${month}.`;
    });

    charts.costsPerDay = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: translate('statistics.chartLabel.costsInCurrency'),
                data: Object.values(data),
                borderColor: chartColors.green[0],
                backgroundColor: chartColors.green[2] + '40',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => value.toFixed(2) + translate('statistics.unit.currency')
                    }
                }
            }
        }
    });
}

// Neue Chart-Funktionen
function updateRefUsageChart(data) {
    const ctx = document.getElementById('refUsageChart');
    if (charts.refUsage) charts.refUsage.destroy();
    
    charts.refUsage = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [translate('statistics.refUsage.withRefs'), translate('statistics.refUsage.withoutRefs')],
            datasets: [{
                data: [data.withRefs, data.withoutRefs],
                backgroundColor: chartColors.purple,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            }
        }
    });
}

function updateAvgRefChart(data) {
    const ctx = document.getElementById('avgRefChart');
    if (charts.avgRef) charts.avgRef.destroy();
    
    const avgRefs = data.withRefs > 0 ? (data.totalRefs / data.withRefs).toFixed(2) : 0;
    
    charts.avgRef = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [translate('statistics.avgRef.xAxisLabel')],
            datasets: [{
                label: translate('statistics.avgRef.chartLabel'),
                data: [avgRefs],
                backgroundColor: chartColors.blue[0],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateRefCostsChart(data) {
    const ctx = document.getElementById('refCostsChart');
    if (charts.refCosts) charts.refCosts.destroy();
    
    // Berechne Kosten (3 Cent pro Referenzbild)
    const refCosts = data.totalRefs * 3;
    const totalCosts = data.withRefs * 6; // Annahme: Durchschnittlich 6 Cent pro Bild
    
    charts.refCosts = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [translate('statistics.refCosts.baseGeneration'), translate('statistics.refCosts.referenceImages')],
            datasets: [{
                data: [totalCosts, refCosts],
                backgroundColor: chartColors.orange,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return `${context.label}: ${(value / 100).toFixed(2)}${translate('statistics.unit.currency')}`;
                        }
                    }
                }
            }
        }
    });
}

function updateBatchStatsChart(data) {
    const ctx = document.getElementById('batchStatsChart');
    if (charts.batchStats) charts.batchStats.destroy();
    
    // Initialize batch statistics
    const batchCounts = {
        single: 0,
        batch2: 0,
        batch3: 0,
        batch4: 0
    };

    // Count batch sizes based on the number of images per batch ID
    if (data.batches) {
        Object.entries(data.batches).forEach(([batchId, count]) => {
            if (count === 1) {
                batchCounts.single++;
            } else if (count >= 2 && count <= 4) {
                batchCounts['batch' + count]++;
            }
        });
    }
    
    charts.batchStats = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [translate('statistics.batchStats.singleImage'), translate('statistics.batchStats.twoImages'), translate('statistics.batchStats.threeImages'), translate('statistics.batchStats.fourImages')],
            datasets: [{
                label: translate('statistics.batchStats.chartLabel'),
                data: [
                    batchCounts.single,
                    batchCounts.batch2,
                    batchCounts.batch3,
                    batchCounts.batch4
                ],
                backgroundColor: chartColors.green[0],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
} 