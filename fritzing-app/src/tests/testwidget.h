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

private slots:
    void onConnectBlinkBoardClicked();
    void onSubmitTestResults(const QString &groupId, const QList<QLineEdit*> &testInputs, const QList<QJsonObject> &testData);
    void onConnectBackendClicked();
    void onRefreshTestsClicked();

signals:
    void testResultsSubmitted(const QString &groupId, const QJsonObject &results);
    void testResultsSubmittedToBackend(const QString &groupId, const QJsonObject &results);
    void testGroupsRequested();
    void blinkBoardConnectionRequested();
    void testsRequested();

private:
    void setupUI();
    void setupConnections();
    void createTestGroupCard(const QJsonObject &testGroup);
    QLineEdit* createSelfObserveTestDisplay(const QJsonObject &test, QWidget *parent, QVBoxLayout *parentLayout);
    void clearCards();
    
    // Backend handling
    void handleTestsReceived(const QJsonArray &tests);

    // UI Components
    QVBoxLayout *m_mainLayout;
    QVBoxLayout *m_cardLayout;
    
    // Data
    QJsonArray m_testGroups;
    
    // Backend connection
    QPushButton *m_connectButton;
    QPushButton *m_refreshTestsButton;
};

#endif // TESTWIDGET_HPP
