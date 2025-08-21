#ifndef TESTWIDGET_HPP
#define TESTWIDGET_HPP

#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QFrame>
#include <QScrollArea>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>
#include <QLineEdit>
#include <QtCharts/QChartView>
#include <QtCharts/QLineSeries>
#include <QtCharts/QChart>
#include <QtCharts/QValueAxis>
#include <QtCharts/QDateTimeAxis>

QT_CHARTS_USE_NAMESPACE

class TestWidget : public QWidget
{
    Q_OBJECT

public:
    explicit TestWidget(QWidget *parent = nullptr);
    ~TestWidget();

public slots:
    void updateTestGroups(const QJsonArray &testGroups);
    void addTestGroup(const QJsonObject &testGroup);
    void clearTestGroups();
    void requestTestsFromBackend();
    void handleTestGroupsUpdated(const QJsonArray &testGroups);
    void handleVoltageDataReceived(const QJsonObject &voltageData);
    void handleMeasureRequest(const QJsonObject &test);

private slots:
    void onConnectBlinkBoardClicked();
    void onSubmitTestResults(const QString &groupId, const QList<QLineEdit*> &testInputs, const QList<QJsonObject> &testData);
    void onConnectBackendClicked();
    void onRefreshTestsClicked();

signals:
    void testResultsSubmitted(const QString &groupId, const QJsonObject &results);
    void testResultsSubmittedToBackend(const QString &groupId, const QJsonObject &results);
    void blinkRequested(const QJsonObject &test, const QString &action);
    void measureRequested(const QJsonObject &test);
    void testGroupsRequested();
    void blinkBoardConnectionRequested();
    void testsRequested();

private:
    void setupUI();
    void setupConnections();
    void createTestGroupCard(const QJsonObject &testGroup);
    QLineEdit* createSelfObserveTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout);
    void createMeasureVoltageTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout);
    void createSwitchConnectionSuggestionTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout);
    void clearCards();
    
    // Backend handling
    void handleTestsReceived(const QJsonArray &tests);

    // UI Components
    QVBoxLayout *m_mainLayout;
    QVBoxLayout *m_cardLayout;
    
    // Data
    QJsonArray m_testGroups;
    
    // Chart for voltage measurements
    QChartView *m_voltageChartView;
    QLineSeries *m_voltageSeries;
    QChart *m_voltageChart;
    
    // Store chart references for individual tests
    QMap<QString, QChart*> m_testCharts;
    QMap<QString, QLineSeries*> m_testSeries;
    
    // Track which test is currently measuring
    QString m_currentMeasuringTestId;
    
    // Track first timestamp for each measurement session
    qint64 m_firstTimestamp;
    
    // Backend connection
    QPushButton *m_connectButton;
    QPushButton *m_refreshTestsButton;
};

#endif // TESTWIDGET_HPP
