#include "testwidget.h"
#include <QMessageBox>
#include <QDateTime>
#include <QLineEdit>
#include <QPainter>
#include <QFont>

TestWidget::TestWidget(QWidget *parent)
    : QWidget(parent)
    , m_mainLayout(nullptr)
    , m_cardLayout(nullptr)
    , m_voltageChartView(nullptr)
    , m_voltageSeries(nullptr)
    , m_voltageChart(nullptr)
{
    setupUI();
    setupConnections();
}

TestWidget::~TestWidget()
{
}

void TestWidget::setupUI()
{
    m_mainLayout = new QVBoxLayout(this);
    
    // Set Fritzing-style margins and spacing
    m_mainLayout->setContentsMargins(10, 10, 10, 10);
    m_mainLayout->setSpacing(15);
    
    // Initialize chart components
    m_voltageChart = new QChart();
    m_voltageSeries = new QLineSeries();
    m_voltageChart->addSeries(m_voltageSeries);
    m_voltageChart->setTitle("Voltage Measurements");
    m_voltageChart->createDefaultAxes();
    
    m_voltageChartView = new QChartView(m_voltageChart);
    m_voltageChartView->setRenderHint(QPainter::Antialiasing);
    m_voltageChartView->setMinimumHeight(200);
    
    // Add test management buttons at the top
    QHBoxLayout *buttonLayout = new QHBoxLayout();
    buttonLayout->addWidget(m_connectButton);
    buttonLayout->addWidget(m_refreshTestsButton);
    buttonLayout->addStretch();
    
    // Style the buttons
    
    m_mainLayout->addLayout(buttonLayout);
    
    // Add separator
    QFrame *separator = new QFrame();
    separator->setFrameShape(QFrame::HLine);
    separator->setFrameShadow(QFrame::Sunken);
    separator->setStyleSheet("QFrame { background-color: #d9d9d9; border: none; }");
    m_mainLayout->addWidget(separator);
    
    // Create scroll area for test group cards
    QScrollArea *scrollArea = new QScrollArea(this);
    scrollArea->setWidgetResizable(true);
    scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    scrollArea->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
    scrollArea->setStyleSheet("QScrollArea { border: none; background-color: transparent; } QScrollBar:vertical { background: #ececec; width: 12px; border-radius: 6px; } QScrollBar::handle:vertical { background: #b1b1b1; border-radius: 6px; min-height: 20px; } QScrollBar::handle:vertical:hover { background: #666666; }");
    
    // Create container widget for cards
    QWidget *cardContainer = new QWidget();
    m_cardLayout = new QVBoxLayout(cardContainer);
    m_cardLayout->setContentsMargins(5, 5, 5, 5);
    m_cardLayout->setSpacing(15);
    
    m_mainLayout->addWidget(scrollArea);
    
    scrollArea->setWidget(cardContainer);
    
    setLayout(m_mainLayout);
    setWindowTitle("Test Groups");
    
    // Style the main widget to match Fritzing background
    setStyleSheet("QWidget { background-color: #d9d9d9; border: none; }");
    
    // Set size policy and minimum dimensions
    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    setMinimumWidth(500);
    setMinimumHeight(600);
}

void TestWidget::setupConnections()
{
    // Connect test management buttons
    connect(m_connectButton, &QPushButton::clicked, this, &TestWidget::onConnectBackendClicked);
    connect(m_refreshTestsButton, &QPushButton::clicked, this, &TestWidget::onRefreshTestsClicked);
}

void TestWidget::updateTestGroups(const QJsonArray &testGroups)
{
    m_testGroups = testGroups;
    clearCards();
    
    for (const QJsonValue &value : testGroups) {
        QJsonObject testGroup = value.toObject();
        createTestGroupCard(testGroup);
    }
}

void TestWidget::addTestGroup(const QJsonObject &testGroup)
{
    m_testGroups.append(testGroup);
    createTestGroupCard(testGroup);
}

void TestWidget::clearTestGroups()
{
    m_testGroups = QJsonArray();
    clearCards();
}



void TestWidget::onConnectBlinkBoardClicked()
{
    emit blinkBoardConnectionRequested();
}

void TestWidget::onSubmitTestResults(const QString &groupId, const QList<QLineEdit*> &testInputs, const QList<QJsonObject> &testData)
{
    // Create the results object with the requested format
    QJsonObject results;
    results["groupId"] = groupId;
    results["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    results["status"] = "completed";
    
    // Gather all test results into the requested JSON format
    QJsonArray testResultsArray;
    for (int i = 0; i < testData.size(); ++i) {
        QJsonObject testResult;
        testResult["name"] = testData[i]["title"].toString();
        testResult["description"] = testData[i]["description"].toString();
        testResult["id"] = testData[i]["id"].toString();
        
        // Get the answer from input field if available, otherwise empty string
        if (i < testInputs.size() && testInputs[i]) {
            testResult["answer"] = testInputs[i]->text();
        } else {
            testResult["answer"] = "";
        }
        
        testResultsArray.append(testResult);
    }
    results["testResults"] = testResultsArray;
    
    qDebug() << "📝 Submitting test results:" << QJsonDocument(results).toJson();
    emit testResultsSubmitted(groupId, results);
    emit testResultsSubmittedToBackend(groupId, results);
}

void TestWidget::clearCards()
{
    // Remove all cards from the layout
    QLayoutItem *item;
    while ((item = m_cardLayout->takeAt(0)) != nullptr) {
        delete item->widget();
        delete item;
    }
}

void TestWidget::createTestGroupCard(const QJsonObject &testGroup)
{
    // Create card container
    QFrame *card = new QFrame(this);
    card->setFrameStyle(QFrame::NoFrame);
    card->setStyleSheet("QFrame { background-color: rgb(243, 243, 243); border: none; border-radius: 0px; padding: 5px; margin: 5px; }");
    
    QVBoxLayout *cardLayout = new QVBoxLayout(card);
    cardLayout->setContentsMargins(15, 15, 15, 15);
    cardLayout->setSpacing(2);
    
    // Group title and description (top section)
    QString groupTitle = testGroup["title"].toString();
    if (groupTitle.isEmpty()) groupTitle = "Untitled Test Group";
    
    QLabel *titleLabel = new QLabel(groupTitle, card);
    titleLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 14px; font-weight: bold; color: #323232; }");
    
    QString groupDescription = testGroup["description"].toString();
    if (groupDescription.isEmpty()) groupDescription = "No description available";
    
    QLabel *descLabel = new QLabel(groupDescription, card);
    descLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 11px; color: #666666; }");
    descLabel->setWordWrap(true);

     
    // Add all elements to card layout
    cardLayout->addWidget(titleLabel);
    cardLayout->addWidget(descLabel);
    
    // Tests to be performed (middle section)
    QJsonArray tests = testGroup["tests"].toArray();
    QList<QLineEdit*> testInputs; // Store references to input fields
    QList<QJsonObject> testData; // Store test data for submission
    
    if (!tests.isEmpty()) {
        QLabel *testsLabel = new QLabel("Tests to perform:", card);
        testsLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 11px; font-weight: bold; color: #323232; margin-top: 5px; }");
        cardLayout->addWidget(testsLabel);

        // Add each test directly to the card layout (no extra frame)
        for (const QJsonValue &testValue : tests) {
            QJsonObject test = testValue.toObject();
            QString testType = test["type"].toString();

            if (testType == "self_observe") {
                QLineEdit* input = createSelfObserveTestDisplay(test, card, cardLayout);
                if (input) {
                    testInputs.append(input);
                    testData.append(test);
                }
            } else if (testType == "measure_voltage") {
                createMeasureVoltageTestDisplay(test, card, cardLayout);
                testData.append(test);
            } else {
                // Minimal display for other test types
                QString testName = test["name"].toString();
                if (testName.isEmpty()) testName = test["title"].toString();
                if (testName.isEmpty()) testName = "Untitled Test";

                QLabel *testLabel = new QLabel(testName, card);
                testLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; color: #666666; margin-left: 15px; }");
                cardLayout->addWidget(testLabel);
                
                // Store test data for submission
                testData.append(test);
            }
        }
    }
    
    // Submit button (bottom section)
    QString groupId = testGroup["id"].toString();
    QPushButton *submitButton = new QPushButton("Submit Test Results", card);
    submitButton->setStyleSheet("QPushButton { padding: 8px 16px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; margin-top: 10px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
    
    // Connect submit button to gather all test data
    connect(submitButton, &QPushButton::clicked, [this, groupId, testInputs, testData]() {
        this->onSubmitTestResults(groupId, testInputs, testData);
    });
   
    
    cardLayout->addWidget(submitButton);
    
    // Add card to main layout
    m_cardLayout->addWidget(card);
}

void TestWidget::handleTestsReceived(const QJsonArray &tests)
{
    qDebug() << "🧪 Received" << tests.size() << "test groups from backend";
    updateTestGroups(tests);
}

void TestWidget::handleTestGroupsUpdated(const QJsonArray &testGroups)
{
    qDebug() << "🧪 Test groups updated from backend";
    updateTestGroups(testGroups);
}

void TestWidget::onConnectBackendClicked()
{
    // This will request tests from the shared backend
    // The backend should already be running from BlinkBoardWidget
    emit testsRequested();
}

void TestWidget::onRefreshTestsClicked()
{
    // This will request tests from the shared backend
    // The backend should already be running from BlinkBoardWidget
    emit testsRequested();
}

void TestWidget::requestTestsFromBackend()
{
    // This method can be called from BlinkBoardWidget to request tests
    // It will emit the signal that BlinkBoardWidget can listen to
    emit testsRequested();
}

QLineEdit* TestWidget::createSelfObserveTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout)
{
    // Create test container widget
    QFrame *testWidget = new QFrame(parent);
    testWidget->setStyleSheet("QFrame { background-color: #d6d6d6; padding: 5px; margin: 5px; }");
    
    QVBoxLayout *testLayout = new QVBoxLayout(testWidget);
    testLayout->setContentsMargins(10, 10, 10, 10);
    testLayout->setSpacing(8);
    
    // Test title
    QLabel *titleLabel = new QLabel(test["title"].toString());
    titleLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 12px; font-weight: bold; color: #333; }");
    testLayout->addWidget(titleLabel);
    
    // Test description
    QLabel *descLabel = new QLabel(test["description"].toString());
    descLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; color: #666; }");
    descLabel->setWordWrap(true);
    testLayout->addWidget(descLabel);
    
    // Observation input area
    QHBoxLayout *inputLayout = new QHBoxLayout();
    inputLayout->setSpacing(10);
    
    // Text input for observation
    QLineEdit *observationInput = new QLineEdit();
    observationInput->setPlaceholderText("What did you observe?");
    observationInput->setStyleSheet("QLineEdit { padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: white; font-family: 'Droid Sans'; font-size: 10px; } QLineEdit:focus { border: 1px solid #f23926; }");
    observationInput->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);
    inputLayout->addWidget(observationInput);
    
    // Blink button
    QPushButton *blinkButton = new QPushButton("Blink");
    blinkButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #f23926; color: white; border: none; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:hover { background: #d32f2f; } QPushButton:pressed { background: #b71c1c; }");
    blinkButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect blink button (placeholder for now)
    connect(blinkButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "🔘 Blink button clicked for self observe test:" << test["title"].toString();
        emit blinkRequested(test, "blink");
    });
    
    inputLayout->addWidget(blinkButton);
    testLayout->addLayout(inputLayout);
    
    // Add test widget to parent layout
    parentLayout->addWidget(testWidget);
    
    qDebug() << "✅ Self observation test displayed in TestWidget:" << test["title"].toString();
    return observationInput; // Return the input field
}

void TestWidget::createMeasureVoltageTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout)
{
    // Create test container widget
    QFrame *testWidget = new QFrame(parent);
    testWidget->setStyleSheet("QFrame { background-color: #d6d6d6; padding: 5px; margin: 5px; }");
    
    QVBoxLayout *testLayout = new QVBoxLayout(testWidget);
    testLayout->setContentsMargins(10, 10, 10, 10);
    testLayout->setSpacing(8);
    
    // Test title
    QLabel *titleLabel = new QLabel(test["title"].toString());
    titleLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 12px; font-weight: bold; color: #333; }");
    testLayout->addWidget(titleLabel);
    
    // Test description
    QLabel *descLabel = new QLabel(test["description"].toString());
    descLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; color: #666; }");
    descLabel->setWordWrap(true);
    testLayout->addWidget(descLabel);
    
    // Graph area (middle section) - now with actual chart
    QFrame *graphFrame = new QFrame(testWidget);
    graphFrame->setStyleSheet("QFrame { background-color: white; border: 2px solid #ccc; border-radius: 5px; min-height: 200px; }");
    graphFrame->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    
    QVBoxLayout *graphLayout = new QVBoxLayout(graphFrame);
    graphLayout->setContentsMargins(0, 0, 0, 0);
    graphLayout->setSpacing(0);
    
    // Create individual chart for this test
    QChart *testChart = new QChart();
    testChart->legend()->hide(); // Hide the legend completely
    
    QLineSeries *testSeries = new QLineSeries();
    testSeries->setName(""); // Empty name to avoid legend entry
    testChart->addSeries(testSeries);
    
    // Create axes
    QValueAxis *axisY = new QValueAxis();
    axisY->setTitleText("Voltage (V)");
    axisY->setRange(0, 5);
    axisY->setLabelFormat("%.2f");
    
    QValueAxis *axisX = new QValueAxis();
    axisX->setTitleText("Time (ms)");
    axisX->setRange(0, 10000); // 10 seconds in milliseconds
    axisX->setLabelFormat("%.0f");
    
    testChart->addAxis(axisY, Qt::AlignLeft);
    testChart->addAxis(axisX, Qt::AlignBottom);
    
    testSeries->attachAxis(axisX);
    testSeries->attachAxis(axisY);
    
    qDebug() << "📊 Chart created with axes - Y:" << axisY->min() << "to" << axisY->max() << "X:" << axisX->min() << "to" << axisX->max();
    qDebug() << "📊 Series attached to axes, series count:" << testSeries->count();
    
    // Create chart view with proper size constraints
    QChartView *testChartView = new QChartView(testChart);
    testChartView->setRenderHint(QPainter::Antialiasing);
    testChartView->setMinimumHeight(180);
    testChartView->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    testChartView->setContentsMargins(0, 0, 0, 0);
    
    // Store chart references in the test object for later updates
    QString testId = test["id"].toString();
    if (!testId.isEmpty()) {
        m_testCharts[testId] = testChart;
        m_testSeries[testId] = testSeries;
    }
    
    graphLayout->addWidget(testChartView);
    testLayout->addWidget(graphFrame);
    
    // Add some spacing after the graph
    testLayout->addSpacing(10);
    
    // Button area (bottom section)
    QHBoxLayout *buttonLayout = new QHBoxLayout();
    buttonLayout->setSpacing(10);
    
    // Blink button
    QPushButton *blinkButton = new QPushButton("Blink", testWidget);
    blinkButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #f23926; color: white; border: none; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:hover { background: #d32f2f; } QPushButton:pressed { background: #b71c1c; }");
    blinkButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect blink button (placeholder for now)
    connect(blinkButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "🔘 Blink button clicked for measure voltage test:" << test["title"].toString();
        emit blinkRequested(test, "blink");
    });
    
    // Measure button
    QPushButton *measureButton = new QPushButton("Measure", testWidget);
    measureButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #0078d4; color: white; border: none; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:hover { background: #005a9e; } QPushButton:pressed { background: #004578; }");
    measureButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect measure button (placeholder for now)
    connect(measureButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "📊 Measure button clicked for measure voltage test:" << test["title"].toString();
        qDebug() << "📊 Test ID:" << test["id"].toString();
        this->handleMeasureRequest(test);
    });
    
    buttonLayout->addWidget(blinkButton);
    buttonLayout->addWidget(measureButton);
    buttonLayout->addStretch(); // Push buttons to the left
    
    testLayout->addLayout(buttonLayout);
    
    // Add test widget to parent layout
    parentLayout->addWidget(testWidget);
    
    qDebug() << "✅ Measure voltage test displayed in TestWidget:" << test["title"].toString();
}

void TestWidget::handleVoltageDataReceived(const QJsonObject &voltageData)
{
    qDebug() << "📊 TestWidget received voltage data:" << voltageData;
    
    // Extract voltage values
    double a0 = voltageData["a0"].toDouble();
    double a1 = voltageData["a1"].toDouble();
    double a2 = voltageData["a2"].toDouble();
    qint64 timestamp = voltageData["timestamp"].toVariant().toLongLong();
    
    qDebug() << "Voltage values - A0:" << a0 << "A1:" << a1 << "A2:" << a2 << "at" << timestamp;
    
    // Find the current measuring test and update its chart
    if (!m_currentMeasuringTestId.isEmpty() && m_testSeries.contains(m_currentMeasuringTestId)) {
        QLineSeries *series = m_testSeries[m_currentMeasuringTestId];
        if (series) {
            // Calculate milliseconds since the first measurement
            static qint64 firstTimestamp = 0;
            if (firstTimestamp == 0) {
                firstTimestamp = timestamp;
            }
            
            qint64 msSinceStart = timestamp - firstTimestamp;
            
            // Get the test data to determine which pin to plot
            QJsonObject currentTest;
            for (const QJsonValue &groupValue : m_testGroups) {
                QJsonObject group = groupValue.toObject();
                QJsonArray tests = group["tests"].toArray();
                for (const QJsonValue &testValue : tests) {
                    QJsonObject test = testValue.toObject();
                    if (test["id"].toString() == m_currentMeasuringTestId) {
                        currentTest = test;
                        break;
                    }
                }
                if (!currentTest.isEmpty()) break;
            }
            
            // Determine which voltage value to plot based on test.measure_pin
            double voltageToPlot = a0; // default to A0
            QString measurePin = currentTest["measurePin"].toString().toLower();
            if (measurePin == "a1") {
                voltageToPlot = a1;
            } else if (measurePin == "a2") {
                voltageToPlot = a2;
            }
            
            qDebug() << "📊 Adding data point: ms=" << msSinceStart << "voltage=" << voltageToPlot << "from pin" << measurePin;
            
            // Add point to the series using milliseconds since start
            series->append(msSinceStart, voltageToPlot);
            
            // Update the corresponding chart
            QChart *chart = m_testCharts[m_currentMeasuringTestId];
            if (chart) {
                qDebug() << "📊 Updating chart with" << series->count() << "data points";
                chart->update();
                
                // Force a repaint of the chart view
                QChartView *chartView = qobject_cast<QChartView*>(chart->parent());
                if (chartView) {
                    chartView->repaint();
                }
            }
        } else {
            qDebug() << "⚠️ No series available for test ID:" << m_currentMeasuringTestId;
        }
    } else {
        qDebug() << "⚠️ No current measuring test or no series available for ID:" << m_currentMeasuringTestId;
    }
}

void TestWidget::handleMeasureRequest(const QJsonObject &test)
{
    qDebug() << "📊 Measure button clicked for measure voltage test:" << test["title"].toString();
    
    // Set this test as the current measuring test
    m_currentMeasuringTestId = test["id"].toString();
    qDebug() << "📊 Set current measuring test ID:" << m_currentMeasuringTestId;
    
    emit measureRequested(test);
}


