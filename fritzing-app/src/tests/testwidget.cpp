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
    // Stop all playhead animations before updating
    stopAllPlayheadAnimations();
    
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
    // Stop all playhead animations before clearing
    stopAllPlayheadAnimations();
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
        
        // Check if this is a measure voltage test
        QString testType = testData[i]["type"].toString();
        qDebug() << "📊 Processing test type:" << testType << "for test:" << testData[i]["id"].toString();
        
        if (testType == "measure_voltage") {
            // Collect voltage data from the chart
            QString testId = testData[i]["id"].toString();
            qDebug() << "📊 Looking for voltage data for test ID:" << testId;
            qDebug() << "📊 Available test series keys:" << m_testSeries.keys();
            
            if (m_testSeries.contains(testId)) {
                QLineSeries *series = m_testSeries[testId];
                if (series && series->count() > 0) {
                    // Format voltage data as JSON array
                    QJsonArray voltageDataArray;
                    for (int j = 0; j < series->count(); ++j) {
                        QPointF point = series->at(j);
                        QJsonObject voltagePoint;
                        voltagePoint["voltage_reading"] = point.y();
                        voltagePoint["time"] = point.x();
                        voltageDataArray.append(voltagePoint);
                    }
                    
                    // Convert to JSON string for the answer field
                    QJsonDocument voltageDoc(voltageDataArray);
                    testResult["answer"] = QString::fromUtf8(voltageDoc.toJson(QJsonDocument::Compact));
                    
                    qDebug() << "📊 Collected" << voltageDataArray.size() << "voltage data points for test:" << testId;
                    qDebug() << "📊 Sample data:" << QString::fromUtf8(voltageDoc.toJson(QJsonDocument::Compact));
                } else {
                    testResult["answer"] = "No voltage data collected (series empty)";
                    qDebug() << "⚠️ Series is empty for test:" << testId;
                }
            } else {
                testResult["answer"] = "No voltage data available (series not found)";
                qDebug() << "⚠️ No test series found for test ID:" << testId;
            }
        } else if (testType == "switch_connection_suggestion") {
            // Read the latest completion status from m_testGroups (updated by the toggle), not from the original testData
            const QString testId = testData[i]["id"].toString();
            QString completionStatus;
            bool foundInSpecifiedGroup = false;

            // Try to find the test in the specified group first
            for (int groupIndex = 0; groupIndex < m_testGroups.size(); ++groupIndex) {
                QJsonObject groupObj = m_testGroups[groupIndex].toObject();
                if (groupObj["id"].toString() == groupId) {
                    QJsonArray testsArr = groupObj["tests"].toArray();
                    for (int ti = 0; ti < testsArr.size(); ++ti) {
                        QJsonObject tObj = testsArr[ti].toObject();
                        if (tObj["id"].toString() == testId) {
                            completionStatus = tObj["userObservation"].toString();
                            foundInSpecifiedGroup = true;
                            break;
                        }
                    }
                    break;
                }
            }

            // Fallback: scan all groups for robustness
            if (!foundInSpecifiedGroup && completionStatus.isEmpty()) {
                for (int groupIndex = 0; groupIndex < m_testGroups.size(); ++groupIndex) {
                    QJsonArray testsArr = m_testGroups[groupIndex].toObject()["tests"].toArray();
                    for (int ti = 0; ti < testsArr.size(); ++ti) {
                        QJsonObject tObj = testsArr[ti].toObject();
                        if (tObj["id"].toString() == testId) {
                            completionStatus = tObj["userObservation"].toString();
                            break;
                        }
                    }
                    if (!completionStatus.isEmpty()) break;
                }
            }

            if (completionStatus.isEmpty()) completionStatus = "incomplete";
            testResult["answer"] = completionStatus;
            qDebug() << "🔌 Switch connection test completion status (from m_testGroups):" << completionStatus;
        } else {
            // Get the answer from input field if available, otherwise empty string
            if (i < testInputs.size() && testInputs[i]) {
                testResult["answer"] = testInputs[i]->text();
            } else {
                testResult["answer"] = "";
            }
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
    // Stop all playhead animations
    for (const QString &testId : m_playheadTimers.keys()) {
        stopPlayheadAnimation(testId);
    }
    
    // Remove all cards from the layout
    QLayoutItem *item;
    while ((item = m_cardLayout->takeAt(0)) != nullptr) {
        delete item->widget();
        delete item;
    }
    
    // Clear chart references
    m_testCharts.clear();
    m_testSeries.clear();
    
    // Clear playhead data
    m_playheadTimers.clear();
    m_playheadPositions.clear();
    m_playheadPatterns.clear();
    m_playheadTotalDurations.clear();
    m_currentVoltageStates.clear();
    
    // Reset measuring state
    m_currentMeasuringTestId.clear();
    m_firstTimestamp = 0;
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
            } else if (testType == "switch_connection_suggestion") {
                createSwitchConnectionSuggestionTestDisplay(test, card, cardLayout);
                testData.append(test);
            } else if (testType == "high_low_voltage") {
                createHighLowVoltageTestDisplay(test, card, cardLayout);
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
    observationInput->setStyleSheet("QLineEdit { padding: 6px; border: 1px solid #ccc; border-radius: 3px; background: white; font-family: 'Droid Sans'; font-size: 10px; color: #323232; } QLineEdit:focus { border: 1px solid #f23926; }");
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
    testLayout->setSpacing(12);
    
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
    graphFrame->setStyleSheet("QFrame { background-color: white; min-height: 300px; }");
    graphFrame->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    
    QVBoxLayout *graphLayout = new QVBoxLayout(graphFrame);
    graphLayout->setContentsMargins(0, 0, 0, 0);
    graphLayout->setSpacing(0);
    
    // Create individual chart for this test
    QChart *testChart = new QChart();
    testChart->legend()->hide(); // Hide the legend completely
    testChart->setTitle("Voltage Reading");
    
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
    
    // Create chart view with proper size constraints for full expansion
    QChartView *testChartView = new QChartView(testChart);
    testChartView->setRenderHint(QPainter::Antialiasing);
    testChartView->setMinimumHeight(250);
    testChartView->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    testChartView->setContentsMargins(0, 0, 0, 0);
    
    // Store chart references in the test object for later updates
    QString testId = test["id"].toString();
    if (!testId.isEmpty()) {
        m_testCharts[testId] = testChart;
        m_testSeries[testId] = testSeries;
        qDebug() << "📊 Stored chart and series for test ID:" << testId;
        qDebug() << "📊 Total charts stored:" << m_testCharts.size();
        qDebug() << "📊 Total series stored:" << m_testSeries.size();
    } else {
        qDebug() << "⚠️ Test ID is empty, cannot store chart references";
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

void TestWidget::createSwitchConnectionSuggestionTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout)
{
    // Create test container widget with consistent styling
    QFrame *testWidget = new QFrame(parent);
    testWidget->setStyleSheet("QFrame { background-color: #d6d6d6; padding: 5px; margin: 5px; }");
    
    QVBoxLayout *testLayout = new QVBoxLayout(testWidget);
    testLayout->setContentsMargins(10, 10, 10, 10);
    testLayout->setSpacing(8);
    
    // Test title - consistent with other tests
    QLabel *titleLabel = new QLabel(test["title"].toString());
    titleLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 12px; font-weight: bold; color: #333; }");
    testLayout->addWidget(titleLabel);
    
    // Test description - consistent with other tests
    QLabel *descLabel = new QLabel(test["description"].toString());
    descLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; color: #666; }");
    descLabel->setWordWrap(true);
    testLayout->addWidget(descLabel);
    
    // Middle section - connection suggestion text
    QString rowFrom = test["row_from"].toString();
    QString rowTo = test["row_to"].toString();
    
    // Debug: Print the test data to see what's available
    qDebug() << "🔌 Switch connection test data:" << test;
    qDebug() << "🔌 jsondata:" << test["jsondata"];
    qDebug() << "🔌 row_from raw:" << test["row_from"];
    qDebug() << "🔌 row_to raw:" << test["row_to"];
    qDebug() << "🔌 row_from type:" << test["row_from"].type();
    qDebug() << "🔌 row_to type:" << test["row_to"].type();
    qDebug() << "🔌 row_from toString:" << rowFrom;
    qDebug() << "🔌 row_to toString:" << rowTo;
    
    QString suggestionText = QString("You should switch the connection on row %1 (non blinking row) to %2 row (blinking)").arg(rowFrom).arg(rowTo);
    
    QLabel *suggestionLabel = new QLabel(suggestionText);
    suggestionLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 11px; color: #333; background-color: #f0f0f0; padding: 8px; border: 1px solid #ccc; border-radius: 3px; }");
    suggestionLabel->setWordWrap(true);
    suggestionLabel->setAlignment(Qt::AlignCenter);
    testLayout->addWidget(suggestionLabel);
    
    // Button area (bottom section) - consistent with other tests
    QHBoxLayout *buttonLayout = new QHBoxLayout();
    buttonLayout->setSpacing(10);
    
    // Blink button - consistent with other tests
    QPushButton *blinkButton = new QPushButton("Blink", testWidget);
    blinkButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #f23926; color: white; border: none; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:hover { background: #d32f2f; } QPushButton:pressed { background: #b71c1c; }");
    blinkButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect blink button
    connect(blinkButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "🔘 Blink button clicked for switch connection test:" << test["title"].toString();
        emit blinkRequested(test, "blink");
    });
    
    // Toggle button for completion
    QPushButton *toggleButton = new QPushButton("Completed the suggestion", testWidget);
    toggleButton->setCheckable(true); // Make it toggleable
    toggleButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:checked { background: #4CAF50; color: white; } QPushButton:hover { background: #666666; color: #ffffff; }");
    toggleButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect toggle button
    connect(toggleButton, &QPushButton::clicked, [this, test, toggleButton]() {
        bool checked = toggleButton->isChecked();
        QString status = checked ? "completed" : "incomplete";
        
        qDebug() << "🔌 Toggle button clicked for test:" << test["id"].toString();
        qDebug() << "🔌 Button checked state:" << checked;
        qDebug() << "🔌 Setting status to:" << status;
        
        // Find and update the test in the test groups
        for (int groupIndex = 0; groupIndex < m_testGroups.size(); ++groupIndex) {
            QJsonObject group = m_testGroups[groupIndex].toObject();
            QJsonArray tests = group["tests"].toArray();
            bool testFound = false;
            
            qDebug() << "🔍 Checking group" << groupIndex << "with" << tests.size() << "tests";
            
            for (int testIndex = 0; testIndex < tests.size(); ++testIndex) {
                QJsonObject testObj = tests[testIndex].toObject();
                if (testObj["id"].toString() == test["id"].toString()) {
                    qDebug() << "🔌 Found test at group" << groupIndex << "test" << testIndex;
                    qDebug() << "🔌 Old userObservation:" << testObj["userObservation"].toString();
                    qDebug() << "🔌 Test ID:" << testObj["id"].toString();
                    
                    // Create a new test object with updated userObservation
                    QJsonObject updatedTestObj = testObj;
                    updatedTestObj["userObservation"] = status;
                    
                    qDebug() << "🔌 Updated test object userObservation:" << updatedTestObj["userObservation"].toString();
                    
                    // Replace the test in the array
                    tests.removeAt(testIndex);
                    tests.insert(testIndex, updatedTestObj);
                    
                    qDebug() << "🔌 After replace - tests array size:" << tests.size();
                    qDebug() << "🔌 After replace - test at index" << testIndex << "userObservation:" << tests[testIndex].toObject()["userObservation"].toString();
                    
                    testFound = true;
                    break;
                }
            }
            
            if (testFound) {
                // Create a new group object with updated tests
                QJsonObject updatedGroup = group;
                updatedGroup["tests"] = tests;
                
                qDebug() << "🔌 Updated group tests array size:" << updatedGroup["tests"].toArray().size();
                qDebug() << "🔌 Updated group test 2 userObservation:" << updatedGroup["tests"].toArray()[2].toObject()["userObservation"].toString();
                
                // Replace the group in m_testGroups
                m_testGroups.removeAt(groupIndex);
                m_testGroups.insert(groupIndex, updatedGroup);
                
                qDebug() << "🔌 m_testGroups size after update:" << m_testGroups.size();
                qDebug() << "🔌 Updated m_testGroups at index" << groupIndex;
                
                // Double check the data is actually there
                QJsonObject finalGroup = m_testGroups[groupIndex].toObject();
                QJsonArray finalTests = finalGroup["tests"].toArray();
                qDebug() << "🔌 Final group tests size:" << finalTests.size();
                if (finalTests.size() > 2) {
                    QJsonObject finalTest = finalTests[2].toObject();
                    qDebug() << "🔌 Final test ID:" << finalTest["id"].toString();
                    qDebug() << "🔌 Final test userObservation:" << finalTest["userObservation"].toString();
                }
                
                qDebug() << "🔌 Verification - test in m_testGroups now has userObservation:" << m_testGroups[groupIndex].toObject()["tests"].toArray()[2].toObject()["userObservation"].toString();
                break;
            }
        }
        
        qDebug() << "✅ Switch connection suggestion" << status << "for test:" << test["title"].toString();
        qDebug() << "📝 Updated test answer to:" << status;
    });
    
    buttonLayout->addWidget(blinkButton);
    buttonLayout->addWidget(toggleButton);
    buttonLayout->addStretch(); // Push buttons to the left
    
    testLayout->addLayout(buttonLayout);
    
    // Add test widget to parent layout
    parentLayout->addWidget(testWidget);
    
    qDebug() << "✅ Switch connection suggestion test displayed in TestWidget:" << test["title"].toString();
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
            if (m_firstTimestamp == 0) {
                m_firstTimestamp = timestamp;
            }
            
            qint64 msSinceStart = timestamp - m_firstTimestamp;
            
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
            
            // Determine which voltage value to plot based on test.blinkboard_adc_row
            double voltageToPlot = a0; // default to A0
            QString blinkboardADCRow = currentTest["blinkboardADCRow"].toString().toLower();
            if (blinkboardADCRow == "a1") {
                voltageToPlot = a1;
            } else if (blinkboardADCRow == "a2") {
                voltageToPlot = a2;
            }
            
            qDebug() << "📊 Adding data point: ms=" << msSinceStart << "voltage=" << voltageToPlot << "from pin" << blinkboardADCRow;
            
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
    
    // Clear previous data and reset the graph for this test
    if (m_testSeries.contains(m_currentMeasuringTestId)) {
        QLineSeries *series = m_testSeries[m_currentMeasuringTestId];
        if (series) {
            series->clear();
            qDebug() << "📊 Cleared previous data for test:" << m_currentMeasuringTestId;
            
            // Update the chart to show the cleared state
            QChart *chart = m_testCharts[m_currentMeasuringTestId];
            if (chart) {
                chart->update();
                qDebug() << "📊 Chart cleared and updated for test:" << m_currentMeasuringTestId;
            }
        }
    }
    
    // Reset the first timestamp for new measurement session
    m_firstTimestamp = 0;
    qDebug() << "📊 Reset timestamp for new measurement session";
    
    emit measureRequested(test);
}

void TestWidget::createHighLowVoltageTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout)
{
    // Create test container widget
    QFrame *testWidget = new QFrame(parent);
    testWidget->setStyleSheet("QFrame { background-color: #d6d6d6; padding: 5px; margin: 5px; }");
    
    QVBoxLayout *testLayout = new QVBoxLayout(testWidget);
    testLayout->setContentsMargins(10, 10, 10, 10);
    testLayout->setSpacing(12);
    
    // Test title
    QLabel *titleLabel = new QLabel(test["title"].toString());
    titleLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 12px; font-weight: bold; color: #333; }");
    testLayout->addWidget(titleLabel);
    
    // Test description
    QLabel *descLabel = new QLabel(test["description"].toString());
    descLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; color: #666; }");
    descLabel->setWordWrap(true);
    testLayout->addWidget(descLabel);
    
    // Graph area (middle section) - Square wave chart
    QFrame *graphFrame = new QFrame(testWidget);
    graphFrame->setStyleSheet("QFrame { background-color: white; min-height: 300px; border: 1px solid #ccc; }");
    graphFrame->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    
    QVBoxLayout *graphLayout = new QVBoxLayout(graphFrame);
    graphLayout->setContentsMargins(10, 10, 10, 10);
    graphLayout->setSpacing(0);
    
    // Create chart for this test
    QChart *testChart = new QChart();
    testChart->legend()->hide();
    testChart->setTitle("High/Low Voltage Pattern");
    
    // Create series for the square wave
    QLineSeries *squareWaveSeries = new QLineSeries();
    squareWaveSeries->setName("Voltage Pattern");
    
    // Create series for the playhead (vertical line)
    QLineSeries *playheadSeries = new QLineSeries();
    playheadSeries->setName("Playhead");
    playheadSeries->setPen(QPen(Qt::red, 2, Qt::SolidLine));
    
    // Extract the high/low pattern from test data
    QJsonArray highLowPattern = test["jsondata"]["high_low_pattern"].toArray();
    
    // Calculate total duration and create square wave
    int totalDuration = 0;
    QList<QPointF> squareWavePoints;
    
    // Start at origin
    squareWavePoints.append(QPointF(0, 0));
    
    // Generate square wave based on the pattern
    for (const QJsonValue &patternValue : highLowPattern) {
        QJsonObject pattern = patternValue.toObject();
        QString voltage = pattern["voltage"].toString();
        int duration = pattern["duration"].toInt();
        
        double voltageLevel = (voltage == "high") ? 5.0 : 0.0;
        
        // Add points to create square wave
        squareWavePoints.append(QPointF(totalDuration, voltageLevel));
        totalDuration += duration;
        squareWavePoints.append(QPointF(totalDuration, voltageLevel));
    }
    
    // Add final point to complete the pattern
    if (totalDuration > 0) {
        squareWavePoints.append(QPointF(totalDuration, 0));
    }
    
    // Add points to the series
    for (const QPointF &point : squareWavePoints) {
        squareWaveSeries->append(point);
    }
    
    // Add series to chart
    testChart->addSeries(squareWaveSeries);
    testChart->addSeries(playheadSeries);
    
    // Create axes
    QValueAxis *axisY = new QValueAxis();
    axisY->setTitleText("Voltage (V)");
    axisY->setRange(0, 8);
    axisY->setLabelFormat("%.1f");
    axisY->setTickCount(6);
    
    QValueAxis *axisX = new QValueAxis();
    axisX->setTitleText("Time (ms)");
    axisX->setRange(0, totalDuration > 0 ? totalDuration : 1000);
    axisX->setLabelFormat("%.0f");
    
    testChart->addAxis(axisY, Qt::AlignLeft);
    testChart->addAxis(axisX, Qt::AlignBottom);
    
    squareWaveSeries->attachAxis(axisX);
    squareWaveSeries->attachAxis(axisY);
    playheadSeries->attachAxis(axisX);
    playheadSeries->attachAxis(axisY);
    
    // Create chart view
    QChartView *testChartView = new QChartView(testChart);
    testChartView->setRenderHint(QPainter::Antialiasing);
    testChartView->setMinimumHeight(250);
    testChartView->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    
    // Store chart references for playhead animation
    QString testId = test["id"].toString();
    if (!testId.isEmpty()) {
        m_testCharts[testId] = testChart;
        // Store the playhead series for animation
        m_testSeries[testId] = playheadSeries;
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
    
    // Connect blink button - sends blink_request to backend
    connect(blinkButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "🔘 Blink button clicked for high/low voltage test:" << test["title"].toString();
        emit blinkRequested(test, "blink");
    });
    
    // Play Sequence button
    QPushButton *playSequenceButton = new QPushButton("Play Sequence", testWidget);
    playSequenceButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:hover { background: #45a049; } QPushButton:pressed { background: #3d8b40; }");
    playSequenceButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect play sequence button - starts playhead animation
    connect(playSequenceButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "▶️ Play Sequence button clicked for high/low voltage test:" << test["title"].toString();
        
        QString testId = test["id"].toString();
        if (!testId.isEmpty()) {
            QJsonArray pattern = test["jsondata"]["high_low_pattern"].toArray();
            if (!pattern.isEmpty()) {
                startPlayheadAnimation(testId, pattern);
            } else {
                qDebug() << "⚠️ Test ID is empty, cannot start animation";
            }
        } else {
            qDebug() << "⚠️ Test ID is empty, cannot start animation";
        }
    });
    
    // Stop Sequence button
    QPushButton *stopSequenceButton = new QPushButton("Stop", testWidget);
    stopSequenceButton->setStyleSheet("QPushButton { padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 3px; font-family: 'Droid Sans'; font-size: 10px; } QPushButton:hover { background: #da190b; } QPushButton:pressed { background: #c62828; }");
    stopSequenceButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);
    
    // Connect stop sequence button - stops playhead animation
    connect(stopSequenceButton, &QPushButton::clicked, [this, test]() {
        qDebug() << "⏹️ Stop Sequence button clicked for high/low voltage test:" << test["title"].toString();
        
        QString testId = test["id"].toString();
        if (!testId.isEmpty()) {
            stopPlayheadAnimation(testId);
        }
    });
    
    buttonLayout->addWidget(blinkButton);
    buttonLayout->addWidget(playSequenceButton);
    buttonLayout->addWidget(stopSequenceButton);
    buttonLayout->addStretch(); // Push buttons to the left
    
    testLayout->addLayout(buttonLayout);
    
    // Add some spacing before the observation input
    testLayout->addSpacing(15);
    
    // Observation input area (similar to self_observe_test)
    QLabel *observationLabel = new QLabel("Describe your observation:");
    observationLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; font-weight: bold; color: #333; }");
    testLayout->addWidget(observationLabel);
    
    QLineEdit *observationInput = new QLineEdit(testWidget);
    observationInput->setPlaceholderText("Enter your observation here...");
    observationInput->setStyleSheet("QLineEdit { padding: 8px; border: 1px solid #b1b1b1; border-radius: 3px; background: #ececec; color: #323232; font-family: 'Droid Sans'; font-size: 10px; } QLineEdit:focus { border: 1px solid #f23926; }");
    observationInput->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);
    testLayout->addWidget(observationInput);
    
    // Add test widget to parent layout
    parentLayout->addWidget(testWidget);
    
    qDebug() << "✅ High/Low voltage test displayed in TestWidget:" << test["title"].toString();
}

void TestWidget::startPlayheadAnimation(const QString &testId, const QJsonArray &pattern)
{
    // Stop any existing animation for this test
    stopPlayheadAnimation(testId);
    
    // Calculate total duration
    int totalDuration = 0;
    for (const QJsonValue &patternValue : pattern) {
        QJsonObject p = patternValue.toObject();
        totalDuration += p["duration"].toInt();
    }
    
    // Store pattern and duration
    m_playheadPatterns[testId] = pattern;
    m_playheadTotalDurations[testId] = totalDuration;
    m_playheadPositions[testId] = 0;
    
    // Initialize voltage state to "low" (default state)
    m_currentVoltageStates[testId] = "low";
    
    // Send initial voltage command if the pattern starts with "high"
    if (!pattern.isEmpty()) {
        QJsonObject firstPattern = pattern.first().toObject();
        QString firstVoltage = firstPattern["voltage"].toString();
        if (firstVoltage == "high") {
            // Send initial high voltage command
            QString blinkboardDigitalRow;
            for (const QJsonValue &groupValue : m_testGroups) {
                QJsonObject group = groupValue.toObject();
                QJsonArray tests = group["tests"].toArray();
                
                for (const QJsonValue &testValue : tests) {
                    QJsonObject test = testValue.toObject();
                    if (test["id"].toString() == testId) {
                        QJsonObject jsondata = test["jsondata"].toObject();
                        blinkboardDigitalRow = jsondata["blinkboard_digital_row"].toString();
                        break;
                    }
                }
                if (!blinkboardDigitalRow.isEmpty()) break;
            }
            
            if (!blinkboardDigitalRow.isEmpty()) {
                QJsonObject voltageCommand;
                voltageCommand["cmd"] = "request_high_low";
                voltageCommand["blinkboard_digital_row"] = blinkboardDigitalRow;
                voltageCommand["voltage"] = "high";
                
                emit highLowVoltageRequested(voltageCommand);
                m_currentVoltageStates[testId] = "high";
                
                qDebug() << "🔌 Sending initial high voltage command for pin:" << blinkboardDigitalRow << "at animation start";
            }
        }
    }
    
    // Create and start timer
    QTimer *timer = new QTimer(this);
    timer->setInterval(50); // Update every 50ms for smooth animation
    
    connect(timer, &QTimer::timeout, [this, testId]() {
        updatePlayheadPosition(testId);
    });
    
    m_playheadTimers[testId] = timer;
    timer->start();
    
    qDebug() << "▶️ Started playhead animation for test:" << testId << "Total duration:" << totalDuration << "ms";
}

void TestWidget::updatePlayheadPosition(const QString &testId)
{
    if (!m_playheadTimers.contains(testId) || !m_testSeries.contains(testId)) {
        return;
    }
    
    QLineSeries *playheadSeries = m_testSeries[testId];
    int currentPos = m_playheadPositions[testId];
    int totalDuration = m_playheadTotalDurations[testId];
    
    // Clear previous playhead
    playheadSeries->clear();
    
    // Update position
    currentPos += 50; // Move by timer interval
    m_playheadPositions[testId] = currentPos;
    
    // Check if animation is complete
    if (currentPos >= totalDuration) {
        // Send final low voltage command before stopping only if current state is not already low
        if (m_testCharts.contains(testId)) {
            QString currentState = m_currentVoltageStates.value(testId, "low");
            if (currentState != "low") {
                QString blinkboardDigitalRow;
                for (const QJsonValue &groupValue : m_testGroups) {
                    QJsonObject group = groupValue.toObject();
                    QJsonArray tests = group["tests"].toArray();
                    
                    for (const QJsonValue &testValue : tests) {
                        QJsonObject test = testValue.toObject();
                        if (test["id"].toString() == testId) {
                            QJsonObject jsondata = test["jsondata"].toObject();
                            blinkboardDigitalRow = jsondata["blinkboard_digital_row"].toString();
                            break;
                        }
                    }
                    if (!blinkboardDigitalRow.isEmpty()) break;
                }
                
                if (!blinkboardDigitalRow.isEmpty()) {
                    // Send low voltage command to turn off
                    QJsonObject voltageCommand;
                    voltageCommand["cmd"] = "request_high_low";
                    voltageCommand["blinkboard_digital_row"] = blinkboardDigitalRow;
                    voltageCommand["voltage"] = "low";
                    
                    emit highLowVoltageRequested(voltageCommand);
                    m_currentVoltageStates[testId] = "low";
                    qDebug() << "🔌 Sending final low voltage command for pin:" << blinkboardDigitalRow << "at animation completion";
                }
            }
        }
        
        stopPlayheadAnimation(testId);
        return;
    }
    
    // Determine current voltage level based on playhead position
    QString currentVoltage = "low"; // Default to low
    if (m_playheadPatterns.contains(testId)) {
        QJsonArray pattern = m_playheadPatterns[testId];
        int accumulatedTime = 0;
        
        for (const QJsonValue &patternValue : pattern) {
            QJsonObject p = patternValue.toObject();
            int duration = p["duration"].toInt();
            QString voltage = p["voltage"].toString();
            
            if (currentPos >= accumulatedTime && currentPos < accumulatedTime + duration) {
                currentVoltage = voltage;
                break;
            }
            accumulatedTime += duration;
        }
    }
    
    // Send voltage command to backend only when voltage level changes
    if (m_testCharts.contains(testId)) {
        // Check if voltage level has changed
        QString previousVoltage = m_currentVoltageStates.value(testId, "low");
        if (currentVoltage != previousVoltage) {
            // Get the test data to find the blinkboard_digital_row
            QString blinkboardDigitalRow;
            for (const QJsonValue &groupValue : m_testGroups) {
                QJsonObject group = groupValue.toObject();
                QJsonArray tests = group["tests"].toArray();
                
                for (const QJsonValue &testValue : tests) {
                    QJsonObject test = testValue.toObject();
                    if (test["id"].toString() == testId) {
                        QJsonObject jsondata = test["jsondata"].toObject();
                        blinkboardDigitalRow = jsondata["blinkboard_digital_row"].toString();
                        break;
                    }
                }
                if (!blinkboardDigitalRow.isEmpty()) break;
            }
            
            if (!blinkboardDigitalRow.isEmpty()) {
                // Create the voltage command
                QJsonObject voltageCommand;
                voltageCommand["cmd"] = "request_high_low";
                voltageCommand["blinkboard_digital_row"] = blinkboardDigitalRow;
                voltageCommand["voltage"] = currentVoltage;
                
                // Send to backend via the high/low voltage signal
                emit highLowVoltageRequested(voltageCommand);
                
                // Update the stored voltage state
                m_currentVoltageStates[testId] = currentVoltage;
                
                qDebug() << "🔌 Voltage changed from" << previousVoltage << "to" << currentVoltage << "for pin:" << blinkboardDigitalRow << "at position:" << currentPos << "ms";
            }
        }
    }
    
    // Draw playhead as vertical line
    QList<QPointF> playheadPoints;
    playheadPoints.append(QPointF(currentPos, 0));
    playheadPoints.append(QPointF(currentPos, 5));
    
    for (const QPointF &point : playheadPoints) {
        playheadSeries->append(point);
    }
    
    // Update the chart
    QChart *chart = m_testCharts[testId];
    if (chart) {
        chart->update();
    }
}

void TestWidget::stopPlayheadAnimation(const QString &testId)
{
    if (m_playheadTimers.contains(testId)) {
        QTimer *timer = m_playheadTimers[testId];
        timer->stop();
        timer->deleteLater();
        m_playheadTimers.remove(testId);
    }
    
    // Clear playhead
    if (m_testSeries.contains(testId)) {
        QLineSeries *playheadSeries = m_testSeries[testId];
        playheadSeries->clear();
        
        // Update the chart
        QChart *chart = m_testCharts[testId];
        if (chart) {
            chart->update();
        }
    }
    
    // Send final low voltage command to turn off the output only if current state is not already low
    if (m_testCharts.contains(testId)) {
        QString currentState = m_currentVoltageStates.value(testId, "low");
        if (currentState != "low") {
            QString blinkboardDigitalRow;
            for (const QJsonValue &groupValue : m_testGroups) {
                QJsonObject group = groupValue.toObject();
                QJsonArray tests = group["tests"].toArray();
                
                for (const QJsonValue &testValue : tests) {
                    QJsonObject test = testValue.toObject();
                    if (test["id"].toString() == testId) {
                        QJsonObject jsondata = test["jsondata"].toObject();
                        blinkboardDigitalRow = jsondata["blinkboard_digital_row"].toString();
                        break;
                    }
                }
                if (!blinkboardDigitalRow.isEmpty()) break;
            }
            
            if (!blinkboardDigitalRow.isEmpty()) {
                // Send low voltage command to turn off
                QJsonObject voltageCommand;
                voltageCommand["cmd"] = "request_high_low";
                voltageCommand["blinkboard_digital_row"] = blinkboardDigitalRow;
                voltageCommand["voltage"] = "low";
                
                emit highLowVoltageRequested(voltageCommand);
                m_currentVoltageStates[testId] = "low";
                qDebug() << "🔌 Sending final low voltage command for pin:" << blinkboardDigitalRow << "to turn off output";
            }
        }
    }
    
    m_playheadPositions.remove(testId);
    m_playheadPatterns.remove(testId);
    m_playheadTotalDurations.remove(testId);
    m_currentVoltageStates.remove(testId);
    
    qDebug() << "⏹️ Stopped playhead animation for test:" << testId;
}

void TestWidget::stopAllPlayheadAnimations()
{
    // Stop all running playhead animations
    QStringList testIds = m_playheadTimers.keys();
    for (const QString &testId : testIds) {
        stopPlayheadAnimation(testId);
    }
    
    qDebug() << "⏹️ Stopped all playhead animations";
}


