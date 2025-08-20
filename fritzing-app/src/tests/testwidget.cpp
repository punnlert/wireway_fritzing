#include "testwidget.h"
#include <QMessageBox>
#include <QDateTime>

TestWidget::TestWidget(QWidget *parent)
    : QWidget(parent)
    , m_mainLayout(nullptr)
    , m_cardLayout(nullptr)
    , m_connectButton(new QPushButton(tr("Request Tests")))
    , m_refreshTestsButton(new QPushButton(tr("Refresh Tests")))
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
    
    // Add test management buttons at the top
    QHBoxLayout *buttonLayout = new QHBoxLayout();
    buttonLayout->addWidget(m_connectButton);
    buttonLayout->addWidget(m_refreshTestsButton);
    buttonLayout->addStretch();
    
    // Style the buttons
    m_connectButton->setStyleSheet("QPushButton { padding: 8px 16px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
    m_refreshTestsButton->setStyleSheet("QPushButton { padding: 8px 16px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
    
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

void TestWidget::onSubmitTestResults(const QString &groupId)
{
    // Create a simple results object for now
    QJsonObject results;
    results["groupId"] = groupId;
    results["timestamp"] = QDateTime::currentDateTime().toString(Qt::ISODate);
    results["status"] = "completed";
    
    emit testResultsSubmitted(groupId, results);
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
    card->setFrameStyle(QFrame::Box);
    card->setStyleSheet("QFrame { background-color: rgb(243, 243, 243); border: 1px solid #b1b1b1; border-radius: 0px; padding: 15px; margin: 5px; }");
    
    QVBoxLayout *cardLayout = new QVBoxLayout(card);
    cardLayout->setContentsMargins(15, 15, 15, 15);
    cardLayout->setSpacing(10);
    
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
    
    // Tests to be performed (middle section)
    QJsonArray tests = testGroup["tests"].toArray();
    if (!tests.isEmpty()) {
        for (const QJsonValue &testValue : tests) {
            QJsonObject test = testValue.toObject();
            QString testName = test["name"].toString();
            QString testDesc = test["description"].toString();
            
            QFrame *testItem = new QFrame(card);
            testItem->setStyleSheet("QFrame { background-color: #ececec; border: 1px solid #d0d0d0; border-radius: 0px; padding: 8px; margin: 2px; }");
            
            QVBoxLayout *testLayout = new QVBoxLayout(testItem);
            testLayout->setContentsMargins(8, 8, 8, 8);
            testLayout->setSpacing(4);
            
            QLabel *testNameLabel = new QLabel(testName, testItem);
            testNameLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 11px; font-weight: bold; color: #323232; }");
            
            if (!testDesc.isEmpty()) {
                QLabel *testDescLabel = new QLabel(testDesc, testItem);
                testDescLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 10px; color: #666666; }");
                testDescLabel->setWordWrap(true);
                testLayout->addWidget(testDescLabel);
            }
            
            testLayout->addWidget(testNameLabel);
            cardLayout->addWidget(testItem);
        }
    }
    
    // Submit button (bottom section)
    QString groupId = testGroup["id"].toString();
    QPushButton *submitButton = new QPushButton("Submit Test Results", card);
    submitButton->setStyleSheet("QPushButton { padding: 8px 16px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; margin-top: 10px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
    
    // Connect submit button to the group ID
    connect(submitButton, &QPushButton::clicked, [this, groupId]() {
        this->onSubmitTestResults(groupId);
    });
    
    // Add all elements to card layout
    cardLayout->addWidget(titleLabel);
    cardLayout->addWidget(descLabel);
    
    if (!tests.isEmpty()) {
        QLabel *testsLabel = new QLabel("Tests to perform:", card);
        testsLabel->setStyleSheet("QLabel { font-family: 'Droid Sans'; font-size: 11px; font-weight: bold; color: #323232; margin-top: 10px; }");
        cardLayout->addWidget(testsLabel);
    }
    
    cardLayout->addWidget(submitButton);
    
    // Add card to main layout
    m_cardLayout->addWidget(card);
}

void TestWidget::handleTestsReceived(const QJsonArray &tests)
{
    qDebug() << "🧪 Received" << tests.size() << "test groups from backend";
    updateTestGroups(tests);
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
