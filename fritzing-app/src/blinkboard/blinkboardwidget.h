#ifndef BLINKBOARDWIDGET_H
#define BLINKBOARDWIDGET_H

#include <QPushButton>
#include <QScrollArea>
#include <QVBoxLayout>
#include <QProcess>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>
#include <QDebug>
#include <QTextEdit>
#include <QLineEdit>
#include <QHBoxLayout>
#include <QTimer>
#include <QLabel>
#include <QDialog>
#include <QComboBox>
#include <QVariant>
#include <QWidget>
#include <QObject>

class BlinkBoardWidget : public QScrollArea {
  Q_OBJECT
public:
  BlinkBoardWidget(QWidget *parent = nullptr);
  ~BlinkBoardWidget() = default;

  void updateContent();
  void resetLayout();
  
  // Helper methods for accessing sketch data
  QString currentNetlistXml() const;
  QString breadboardNetlistXml() const;

public slots:
  void handleBlinkBoardConnectionRequest();
  void requestTestsFromBackend();
  void submitTestResultsToBackend(const QString &groupId, const QJsonObject &results);
  void handleBlinkRequest(const QJsonObject &test, const QString &action);
  void handleMeasureRequest(const QJsonObject &test);
  void handleComponentHighlighted(const QJsonObject& componentData);
  void handleMultipleComponentsSelected(const QJsonArray& componentsData);
  void handleComponentDeselected(const QString& componentId);

signals:
  void testsReceived(const QJsonArray &tests);
  void testGroupsUpdated(const QJsonArray &testGroups);
  void voltageDataReceived(const QJsonObject &voltageData);

protected slots:
  void handleButtonClick();
  void handleNodeProcessOutput();
  void handleNodeProcessError();
  void handleNodeStarted();
  void handleNodeError(QProcess::ProcessError error);
  void handleNodeFinished(int exitCode, QProcess::ExitStatus exitStatus);
  void handleSendMessage();
  void handleMessageReceived(const QString &message);
  void handleUpdateSchematics();
  void handleModeToggle();

protected:
  QPushButton *m_actionButton;
  QVBoxLayout *m_mainLayout;
  QProcess *m_nodeProcess;
  
  // Status indicator
  QLabel *m_statusIndicator;
  
  // Loading indicator for AI responses
  QLabel *m_loadingIndicator;
  QTimer *m_loadingAnimationTimer;
  
  // Serial ports
  QJsonArray m_serialPorts;
  
  // Chat interface elements
  QTextEdit *m_chatDisplay;
  QLineEdit *m_messageInput;
  QPushButton *m_sendButton;
  QPushButton *m_updateSchematicsButton;
  QHBoxLayout *m_inputLayout;
  
  // Mode toggle switch
  QPushButton *m_modeToggleButton;
  bool m_isAskingMode;
  QLabel *m_modeIndicatorLabel;
  
  // Highlighted components storage
  QJsonArray m_highlightedComponents;
  QLabel *m_highlightedComponentsLabel;
  
  // Loading indicator for AI responses
  void startNodeBackend();
  void sendCommandToNode(const QString &command);
  void addChatMessage(const QString &message, bool isUser = true);
  void updateButtonColor(bool isConnected);
  
  // Simple streaming status handling
  void handleStreamingStart();
  void handleStreamingDone();

  // Function calling handling
  void handleFunctionCalling();

  // Serial port handling
  void handleSerialPortsReceived(const QJsonArray &ports);
  void showPortSelectionDialog();
  void connectToSelectedPort(const QString &portPath);
  
  // Test handling
  void handleTestsReceived(const QJsonArray &tests);
  
  // Highlighted components management
  void addHighlightedComponent(const QJsonObject& componentData);
  void removeHighlightedComponent(const QString& componentId);
  void clearHighlightedComponents();
  void refreshHighlightedComponents();
  QJsonArray getHighlightedComponents() const;
  void updateHighlightedComponentsDisplay();
  
  // Modified chat message handling
  void handleSendMessageWithContext();
  void handleAnalogReadData(const QJsonObject &event);
};
#endif
