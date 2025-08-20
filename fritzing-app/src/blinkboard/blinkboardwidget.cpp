#include "blinkboardwidget.h"
#include <QFrame>
#include <QProcess>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>
#include <QDebug>
#include <QDir>
#include <QFileInfo>
#include <QDomDocument>
#include <QDomElement>
#include <QHash>
#include <QList>
#include <QPointer>

// Forward declarations for sketch-related classes
class MainWindow;
class SketchAreaWidget;
class SketchWidget;
class BreadboardSketchWidget;
class SchematicSketchWidget;
class ConnectorItem;
class ErcData;

// Include the actual headers
#include "../mainwindow/mainwindow.h"
#include "../mainwindow/sketchareawidget.h"
#include "../sketch/sketchwidget.h"
#include "../sketch/breadboardsketchwidget.h"
#include "../sketch/schematicsketchwidget.h"
#include "../connectors/connectoritem.h"
#include "../connectors/ercdata.h"
#include "../viewlayer.h"

BlinkBoardWidget::BlinkBoardWidget(QWidget *parent)
    : QScrollArea(parent), m_actionButton(new QPushButton(tr("Connect to BlinkBoard"))),
      m_mainLayout(new QVBoxLayout()),
      m_nodeProcess(new QProcess(this)),
      m_chatDisplay(new QTextEdit()),
      m_messageInput(new QLineEdit()),
      m_sendButton(new QPushButton("Send")),
      m_updateSchematicsButton(new QPushButton("Update Schematics")),
      m_inputLayout(new QHBoxLayout()) {

  auto frame = new QFrame(this);

  m_mainLayout->setSizeConstraint(QLayout::SetMinAndMaxSize); // Remove size constraint
  m_mainLayout->setObjectName("BlinkBoardFrame");
  m_mainLayout->setContentsMargins(0, 0, 0, 0); // Remove margins to use full width
  
  // Setup chat display
  m_chatDisplay->setReadOnly(true);
  m_chatDisplay->setMinimumWidth(400); // Set minimum width
  m_chatDisplay->setPlaceholderText("Chat messages will appear here...");
  m_chatDisplay->setStyleSheet("QTextEdit { background-color:rgb(243, 243, 243); border: 1px solid #b1b1b1; border-radius: 0px; padding: 5px; font-family: 'Droid Sans'; font-size: 11px; color: #323232; }");
  m_chatDisplay->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);

  // Setup message input
  m_messageInput->setPlaceholderText("Type your message here...");
  m_messageInput->setMinimumWidth(300); // Set minimum width
  m_messageInput->setStyleSheet("QLineEdit { padding: 5px; border: 1px solid #b1b1b1; border-radius: 0px; background: #ececec; color: #323232; font-family: 'Droid Sans'; font-size: 11px; } QLineEdit:focus { border: 1px solid #f23926; }");
  m_messageInput->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

  // Setup send button
  m_sendButton->setStyleSheet("QPushButton { padding: 5px 15px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
  m_sendButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);

  // Setup update schematics button
  m_updateSchematicsButton->setStyleSheet("QPushButton { padding: 5px 15px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
  m_updateSchematicsButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);

  // Setup input layout
  m_inputLayout->addWidget(m_messageInput);
  m_inputLayout->addWidget(m_sendButton);
  m_inputLayout->addWidget(m_updateSchematicsButton);
  m_inputLayout->setStretch(0, 1); // Make message input expand
  m_inputLayout->setStretch(1, 0); // Keep send button fixed size
  m_inputLayout->setStretch(2, 0); // Keep update schematics button fixed size
  m_inputLayout->setContentsMargins(0, 0, 0, 0); // Remove margins

  // Setup Node.js connection button (at bottom) - match Fritzing button style
  // Create a horizontal layout for the button to include status indicator
  QHBoxLayout *buttonLayout = new QHBoxLayout();
  buttonLayout->setContentsMargins(8, 0, 8, 0);
  buttonLayout->setSpacing(8);
  
  // Create status indicator circle
  m_statusIndicator = new QLabel();
  m_statusIndicator->setFixedSize(8, 8);
  m_statusIndicator->setStyleSheet("QLabel { background-color: #f44336; border-radius: 4px; }");
  
  // Create loading indicator for AI responses
  m_loadingIndicator = new QLabel();
  m_loadingIndicator->setFixedSize(8, 8);
  m_loadingIndicator->setStyleSheet("QLabel { background-color: #9E9E9E; border-radius: 8px; }");
  m_loadingIndicator->setToolTip("AI response status");
  m_loadingIndicator->hide(); // Hidden by default
  
  // Add status indicator and button text to layout
  buttonLayout->addWidget(m_statusIndicator);
  buttonLayout->addWidget(m_loadingIndicator);
  buttonLayout->addStretch();
  
  // Set the button layout
  m_actionButton->setLayout(buttonLayout);
  
  // Set initial button styling
  m_actionButton->setStyleSheet("QPushButton { padding: 8px 16px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; margin-top: 10px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
  
  // Start with red indicator (not connected)
  updateButtonColor(false);

  // Connect signals
  connect(m_actionButton, SIGNAL(clicked()), this, SLOT(handleButtonClick()));
  connect(m_sendButton, SIGNAL(clicked()), this, SLOT(handleSendMessage()));
  connect(m_updateSchematicsButton, SIGNAL(clicked()), this, SLOT(handleUpdateSchematics()));
  connect(m_messageInput, SIGNAL(returnPressed()), this, SLOT(handleSendMessage()));

  // Connect Node.js process signals
  connect(m_nodeProcess, &QProcess::readyReadStandardOutput, 
          this, &BlinkBoardWidget::handleNodeProcessOutput);
  connect(m_nodeProcess, &QProcess::readyReadStandardError, 
          this, &BlinkBoardWidget::handleNodeProcessError);

  // Add Process State Monitoring - Qt 5 compatible syntax
  connect(m_nodeProcess, SIGNAL(started()), this, SLOT(handleNodeStarted()));
  connect(m_nodeProcess, SIGNAL(errorOccurred(QProcess::ProcessError)), 
          this, SLOT(handleNodeError(QProcess::ProcessError)));
  connect(m_nodeProcess, SIGNAL(finished(int,QProcess::ExitStatus)), 
          this, SLOT(handleNodeFinished(int,QProcess::ExitStatus)));

  // Setup loading animation timer
  m_loadingAnimationTimer = new QTimer(this);
  m_loadingAnimationTimer->setInterval(500); // Animate every 500ms
  connect(m_loadingAnimationTimer, &QTimer::timeout, [this]() {
    if (m_loadingIndicator->isVisible()) {
      // Toggle between blue and light blue for loading effect
      static bool isBright = true;
      if (isBright) {
        m_loadingIndicator->setStyleSheet("QLabel { background-color: #2196F3; border-radius: 8px; }");
      } else {
        m_loadingIndicator->setStyleSheet("QLabel { background-color: #90CAF9; border-radius: 8px; }");
      }
      isBright = !isBright;
    } else {
      m_loadingAnimationTimer->stop();
    }
  });

  // Build the layout directly in main layout (no group box)
  m_mainLayout->setContentsMargins(10, 10, 10, 10);
  m_mainLayout->setSpacing(10); // Add spacing between elements
  
  // Add chat interface at the top
  m_mainLayout->addWidget(m_chatDisplay);
  m_mainLayout->addLayout(m_inputLayout);
  
  // Add separator - match Fritzing separator style
  auto separator = new QFrame();
  separator->setFrameShape(QFrame::HLine);
  separator->setFrameShadow(QFrame::Sunken);
  separator->setStyleSheet("QFrame { background-color: #b1b1b1; border: none; }");
  m_mainLayout->addWidget(separator);
  
  // Add Node.js connection button at the bottom
  m_mainLayout->addWidget(m_actionButton);
  
  // Set stretch factors to make chat area expand
  m_mainLayout->setStretch(0, 1); // Chat display gets most space
  m_mainLayout->setStretch(1, 0); // Input area fixed height
  m_mainLayout->setStretch(2, 0); // Separator fixed height
  m_mainLayout->setStretch(3, 0); // Button fixed height

  frame->setLayout(m_mainLayout);
  frame->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
  
  // Style the main frame to match Fritzing background
  frame->setStyleSheet("QFrame { background-color: #d9d9d9; border: none; }");

  this->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
  this->setWidget(frame);
  this->setWidgetResizable(true);
  this->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
  this->setFrameShape(QFrame::NoFrame);
  
  // Ensure the widget expands to fill available space
  this->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
  this->setMinimumWidth(500); // Set minimum width for the entire widget

  // Add welcome message
  addChatMessage("Welcome to BlinkBoard Chat! Connect to the Node.js backend to start chatting.", false);
}

void BlinkBoardWidget::updateContent() {
  // Update your widget content here
}

void BlinkBoardWidget::resetLayout() {
  // Reset your widget layout here
}

void BlinkBoardWidget::handleButtonClick() {
  if (m_nodeProcess->state() == QProcess::NotRunning) {
    qDebug() << "Attempting to start Node.js backend...";
    startNodeBackend();
  } else {
    qDebug() << "Node.js backend already running, restarting...";
    // Kill the current process and restart
    m_nodeProcess->kill();
    // Wait a bit for the process to terminate
    QTimer::singleShot(1000, this, &BlinkBoardWidget::startNodeBackend);
  }
}

void BlinkBoardWidget::startNodeBackend() {
  // Use hardcoded path to Node.js
  QString nodePath = "/usr/local/bin/node";
  
  // Check if the hardcoded path exists and is executable
  QFileInfo nodeFileInfo(nodePath);
  if (!nodeFileInfo.exists() || !nodeFileInfo.isExecutable()) {
    qDebug() << "❌ Node.js not found at hardcoded path:" << nodePath;
    updateButtonColor(false);
    return;
  }
  
  qDebug() << "✅ Found Node.js at:" << nodePath;
  
  QStringList arguments;
  
  // Get the path to server.js relative to the source directory
  // Go up from build directory to source directory
  QString currentPath = QDir::currentPath();
  qDebug() << "Current working directory:" << currentPath;
  
  // Navigate up from build directory to source directory
  QString sourcePath = currentPath;
  if (sourcePath.contains("/build/")) {
    // Remove everything from /build/ onwards
    int buildIndex = sourcePath.indexOf("/build/");
    sourcePath = sourcePath.left(buildIndex);
    qDebug() << "Detected build directory, using source path:" << sourcePath;
  }
  
  QString serverPath = sourcePath + "/node-backend/server.js";
  
  qDebug() << "Source directory:" << sourcePath;
  qDebug() << "Server path:" << serverPath;
  
  // Check if file exists
  QFileInfo fileInfo(serverPath);
  if (!fileInfo.exists()) {
    qDebug() << "❌ Server.js file not found at:" << serverPath;
    qDebug() << "Tried to find it in:" << sourcePath;
    updateButtonColor(false);
    return;
  }
  
  arguments << serverPath;
  
  qDebug() << "Starting Node.js process...";
  qDebug() << "Node path:" << nodePath;
  qDebug() << "Arguments:" << arguments;
  qDebug() << "Working directory:" << QDir::currentPath();
  
  m_nodeProcess->start(nodePath, arguments);
  
  if (m_nodeProcess->waitForStarted(5000)) { // 5 second timeout
    qDebug() << "✅ Node.js backend started successfully!";
    qDebug() << "Process ID:" << m_nodeProcess->processId();
    qDebug() << "Process state:" << m_nodeProcess->state();
    
    // Update button to green (connected)
    updateButtonColor(true);
    sendCommandToNode("init");
  } else {
    qDebug() << "❌ Failed to start Node.js backend!";
    qDebug() << "Error:" << m_nodeProcess->errorString();
    qDebug() << "Process state:" << m_nodeProcess->state();
    qDebug() << "Exit code:" << m_nodeProcess->exitCode();
    
    // Update button to red (failed)
    updateButtonColor(false);
  }
}

void BlinkBoardWidget::sendCommandToNode(const QString &command) {
  if (m_nodeProcess->state() == QProcess::Running) {
    QJsonObject jsonCommand;
    jsonCommand["command"] = command;
    jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
    
    QJsonDocument doc(jsonCommand);
    QString jsonString = doc.toJson(QJsonDocument::Compact);
    
    qDebug() << "Sending to Node.js:" << jsonString;
    m_nodeProcess->write(jsonString.toUtf8() + "\n");
  } else {
    qDebug() << "Cannot send command - Node.js process not running";
    qDebug() << "Process state:" << m_nodeProcess->state();
  }
}

void BlinkBoardWidget::handleNodeProcessOutput() {
  QString output = QString::fromUtf8(m_nodeProcess->readAllStandardOutput());
  QStringList lines = output.split('\n', QString::SkipEmptyParts);
  
  for (const QString &line : lines) {
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(line.toUtf8(), &error);
    
    if (error.error == QJsonParseError::NoError) {
      QJsonObject response = doc.object();
      qDebug() << "✅ Received from Node.js:" << response;
      
      // Handle streaming status events
      if (response.contains("type")) {
        QString type = response["type"].toString();
        
        if (type == "streaming_start") {
          qDebug() << "🚀 Streaming started from backend";
          handleStreamingStart();
          continue;
        } else if (type == "streaming_done") {
          qDebug() << "✅ Streaming completed from backend";
          handleStreamingDone();
          continue;
        } else if (type == "function_calling") {
          qDebug() << "🚀 Function calling from backend";
          handleFunctionCalling();
          continue;
        }
      }
      
      // Check if this is a chat message response
      if (response.contains("type") && response["type"].toString() == "chat") {
        QString message = response["message"].toString();
        if (!message.isEmpty()) {
          handleMessageReceived(message);
        }
      }
      
      // Check if this contains serial ports (from init or get_serial_ports)
      if (response.contains("serialPorts")) {
        QJsonArray ports = response["serialPorts"].toArray();
        handleSerialPortsReceived(ports);
      }
      
      // Check if this contains test groups
      if (response.contains("testGroups")) {
        QJsonArray tests = response["testGroups"].toArray();
        handleTestsReceived(tests);
      }
      
      // Check if this is a test groups update
      if (response.contains("type") && response["type"].toString() == "test_groups_updated") {
        QJsonArray tests = response["testGroups"].toArray();
        emit testGroupsUpdated(tests);
      }
    } else {
      // Check if it's a raw chat message (non-JSON)
      if (line.startsWith("chat:")) {
        QString message = line.mid(5); // Remove "chat:" prefix
        handleMessageReceived(message);
      } else {
        qDebug() << " Raw output from Node.js:" << line;
      }
    }
  }
}

void BlinkBoardWidget::handleNodeProcessError() {
  QString error = QString::fromUtf8(m_nodeProcess->readAllStandardError());
  qDebug() << "❌ Node.js stderr:" << error;
}

void BlinkBoardWidget::handleNodeStarted() {
  qDebug() << "🎉 Node.js process started signal received!";
  qDebug() << "Process ID:" << m_nodeProcess->processId();
  qDebug() << "Process state:" << m_nodeProcess->state();
  
  // Update button to green (connected)
  updateButtonColor(true);
  
  // Automatically request tests from the backend when it starts
  QTimer::singleShot(1000, this, [this]() {
    if (m_nodeProcess->state() == QProcess::Running) {
      requestTestsFromBackend();
    }
  });
}

void BlinkBoardWidget::handleNodeError(QProcess::ProcessError error) {
  qDebug() << "💥 Node.js process error occurred:" << error;
  qDebug() << "Error string:" << m_nodeProcess->errorString();
  qDebug() << "Process state:" << m_nodeProcess->state();
  
  // Update button to red (error)
  updateButtonColor(false);
}

void BlinkBoardWidget::handleNodeFinished(int exitCode, QProcess::ExitStatus exitStatus) {
  qDebug() << "🏁 Node.js process finished!";
  qDebug() << "Exit code:" << exitCode;
  qDebug() << "Exit status:" << exitStatus;
  qDebug() << "Process state:" << m_nodeProcess->state();
  
  // Update button to red (disconnected)
  updateButtonColor(false);
  
  // Add chat message about disconnection
  addChatMessage("Node.js backend disconnected.", false);
}

void BlinkBoardWidget::handleSendMessage() {
  QString message = m_messageInput->text().trimmed();
  if (message.isEmpty()) {
    return;
  }
  
  // Add user message to chat
  addChatMessage(message, true);
  
  // Clear input field
  m_messageInput->clear();
  
  // Send message to Node.js backend if connected
  if (m_nodeProcess->state() == QProcess::Running) {
    sendCommandToNode("chat:" + message);
  } else {
    addChatMessage("Not connected to backend. Please connect first.", false);
  }
}

void BlinkBoardWidget::handleMessageReceived(const QString &message) {
  addChatMessage(message, false);
}

void BlinkBoardWidget::addChatMessage(const QString &message, bool isUser) {
  QString timestamp = QDateTime::currentDateTime().toString("hh:mm:ss");
  QString formattedMessage;
  
  // First escape HTML characters, then convert newlines to <br> tags
  QString escapedMessage = message.toHtmlEscaped();
  escapedMessage.replace('\n', "<br>");
  
  if (isUser) {
    formattedMessage = QString("<div style='text-align: right; margin: 5px;'><span style='background-color: #821f09; color: white; padding: 5px 10px; border-radius: 0px; display: inline-block; font-family: Droid Sans; font-size: 11px;'>%1</span><br><small style='color: #777777; font-family: Droid Sans; font-size: 9px;'>%2</small></div>")
                      .arg(escapedMessage)
                      .arg(timestamp);
  } else {
    formattedMessage = QString("<div style='margin: 5px;'><span style='background-color: #ececec; color: #323232; padding: 5px 10px; border-radius: 0px; display: inline-block; border: 1px solid #b1b1b1; font-family: Droid Sans; font-size: 11px;'>%1</span><br><small style='color: #777777; font-family: Droid Sans; font-size: 9px;'>%2</small></div>")
                      .arg(escapedMessage)
                      .arg(timestamp);
  }
  
  m_chatDisplay->append(formattedMessage);
  
  // Auto-scroll to bottom
  QTextCursor cursor = m_chatDisplay->textCursor();
  cursor.movePosition(QTextCursor::End);
  m_chatDisplay->setTextCursor(cursor);
}

void BlinkBoardWidget::handleUpdateSchematics() {
  if (m_nodeProcess->state() != QProcess::Running) {
    addChatMessage("Not connected to backend. Please connect first.", false);
    return;
  }

  // Get the current netlist XML
  QString netlistXml = currentNetlistXml();
  if (netlistXml.isEmpty()) {
    addChatMessage("Could not generate netlist. No sketch available.", false);
    return;
  }

  // Add user message to chat
  addChatMessage("Updating schematics with current netlist...", true);

  // Send the netlist XML to the Node.js backend
  QJsonObject jsonCommand;
  jsonCommand["command"] = "update_schematics";
  jsonCommand["netlist"] = netlistXml;
  jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
  
  QJsonDocument doc(jsonCommand);
  QString jsonString = doc.toJson(QJsonDocument::Compact);
  
  qDebug() << "Sending netlist to Node.js:" << jsonString.left(200) + "...";
  m_nodeProcess->write(jsonString.toUtf8() + "\n");
}

// Helper function to find the main window from a widget
static MainWindow *findMainWindow(const QWidget *w) {
  const QWidget *p = w;
  while (p) {
    if (auto mw = qobject_cast<MainWindow*>(p->window())) return mw;
    p = p->parentWidget();
  }
  return nullptr;
}

// Helper function to get the current sketch widget
static SketchWidget *currentSketchFrom(const QWidget *w) {
  if (auto mw = findMainWindow(w)) {
    auto list = mw->sketchWidgets();
    
    // For now, just return the first available sketch widget
    // This will typically be the breadboard view
    if (!list.isEmpty()) {
      return list[0];
    }
  }
  return nullptr;
}

// Helper function to get the breadboard sketch widget
static BreadboardSketchWidget *breadboardViewFrom(const QWidget *w) {
  if (auto mw = findMainWindow(w)) {
    auto list = mw->sketchWidgets();
    if (!list.isEmpty())
      return qobject_cast<BreadboardSketchWidget*>(list[0]);
  }
  return nullptr;
}

QString BlinkBoardWidget::currentNetlistXml() const {
  SketchWidget *sk = currentSketchFrom(this);
  if (!sk) return QString();

  QHash<ConnectorItem*, int> indexer;
  QList<QList<ConnectorItem*>*> nets;
  sk->collectAllNets(indexer, nets, true, sk->boardLayers() > 1);

  // Filter ignored connectors (ERC rules), mirroring exportNetlist()
  QList<QList<ConnectorItem*>*> toDelete;
  for (auto net : nets) {
    QList<ConnectorItem*> remove;
    for (auto ci : *net) {
      if (auto erc = ci->connectorSharedErcData()) {
        if (erc->ignore() == ErcData::Always) remove.append(ci);
        else if (erc->ignore() == ErcData::IfUnconnected && net->count() == 1) remove.append(ci);
      }
    }
    for (auto ci : remove) net->removeOne(ci);
    if (net->isEmpty()) toDelete.append(net);
  }
  for (auto net : toDelete) nets.removeOne(net);

  QDomDocument doc;
  doc.setContent(QString("<?xml version='1.0' encoding='UTF-8'?>\n"));
  QDomElement netlist = doc.createElement("netlist");
  netlist.setAttribute("date", QDateTime::currentDateTime().toString());
  doc.appendChild(netlist);

  for (auto net : nets) {
    QDomElement netEl = doc.createElement("net");
    netlist.appendChild(netEl);
    for (auto ci : *net) {
      QDomElement connEl = doc.createElement("connector");
      connEl.setAttribute("id", ci->connectorSharedID());
      connEl.setAttribute("name", ci->connectorSharedName());

      QDomElement partEl = doc.createElement("part");
      auto item = ci->attachedTo();
      partEl.setAttribute("id", item->id());
      partEl.setAttribute("label", item->instanceTitle());
      partEl.setAttribute("title", item->title());
      connEl.appendChild(partEl);

      if (auto erc = ci->connectorSharedErcData()) {
        QDomElement ercEl = doc.createElement("erc");
        if (erc->writeToElement(ercEl, doc)) connEl.appendChild(ercEl);
      }

      netEl.appendChild(connEl);
    }
  }

  for (auto net : nets) delete net;
  nets.clear();

  return doc.toString(-1);
}

QString BlinkBoardWidget::breadboardNetlistXml() const {
  if (auto bb = breadboardViewFrom(this)) {
    // Build the XML using the breadboard view specifically
    QHash<ConnectorItem*, int> indexer;
    QList<QList<ConnectorItem*>*> nets;
    bb->collectAllNets(indexer, nets, true, bb->boardLayers() > 1);

    QList<QList<ConnectorItem*>*> toDelete;
    for (auto net : nets) {
      QList<ConnectorItem*> remove;
      for (auto ci : *net) {
        if (auto erc = ci->connectorSharedErcData()) {
          if (erc->ignore() == ErcData::Always) remove.append(ci);
          else if (erc->ignore() == ErcData::IfUnconnected && net->count() == 1) remove.append(ci);
        }
      }
      for (auto ci : remove) net->removeOne(ci);
      if (net->isEmpty()) toDelete.append(net);
    }
    for (auto net : toDelete) nets.removeOne(net);

    QDomDocument doc;
    doc.setContent(QString("<?xml version='1.0' encoding='UTF-8'?>\n"));
    QDomElement netlist = doc.createElement("netlist");
    netlist.setAttribute("view", "breadboard");
    netlist.setAttribute("date", QDateTime::currentDateTime().toString());
    doc.appendChild(netlist);

    for (auto net : nets) {
      QDomElement netEl = doc.createElement("net");
      netlist.appendChild(netEl);
      for (auto ci : *net) {
        QDomElement connEl = doc.createElement("connector");
        connEl.setAttribute("id", ci->connectorSharedID());
        connEl.setAttribute("name", ci->connectorSharedName());

        QDomElement partEl = doc.createElement("part");
        auto item = ci->attachedTo();
        partEl.setAttribute("id", item->id());
        partEl.setAttribute("label", item->instanceTitle());
        partEl.setAttribute("title", item->title());
        connEl.appendChild(partEl);

        if (auto erc = ci->connectorSharedErcData()) {
          QDomElement ercEl = doc.createElement("erc");
          if (erc->writeToElement(ercEl, doc)) connEl.appendChild(ercEl);
        }

        netEl.appendChild(connEl);
      }
    }

    for (auto net : nets) delete net;
    nets.clear();

    return doc.toString(-1);
  }
  return QString();
}

void BlinkBoardWidget::updateButtonColor(bool isConnected) {
  if (isConnected) {
    // Green circle when connected
    m_statusIndicator->setStyleSheet("QLabel { background-color: #4CAF50; border-radius: 4px; }");
    // Update button text to "Restart Backend" when connected
    m_actionButton->setText(tr("Restart Backend"));
  } else {
    // Red circle when not connected
    m_statusIndicator->setStyleSheet("QLabel { background-color: #f44336; border-radius: 4px; }");
    // Update button text to "Connect to BlinkBoard" when not connected
    m_actionButton->setText(tr("Connect to BlinkBoard"));
  }
}

void BlinkBoardWidget::handleSerialPortsReceived(const QJsonArray &ports) {
  m_serialPorts = ports;
  qDebug() << "🔌 Received" << ports.size() << "serial ports from backend";
  
  if (ports.isEmpty()) {
    addChatMessage("No serial ports detected. Please check your BlinkBoard connection.", false);
  } else {
    QString portList = "Available serial ports:\n";
    for (const QJsonValue &value : ports) {
      QJsonObject port = value.toObject();
      portList += QString("• %1\n").arg(port["path"].toString());
    }
    addChatMessage(portList, false);
    
    // Show port selection dialog
    showPortSelectionDialog();
  }
}

void BlinkBoardWidget::showPortSelectionDialog() {
  if (m_serialPorts.isEmpty()) {
    addChatMessage("No serial ports available for selection.", false);
    return;
  }
  
  // Create a simple port selection dialog
  QDialog *dialog = new QDialog(this);
  dialog->setWindowTitle("Select BlinkBoard Port");
  dialog->setModal(true);
  
  QVBoxLayout *layout = new QVBoxLayout(dialog);
  
  QLabel *label = new QLabel("Select the serial port for your BlinkBoard:", dialog);
  layout->addWidget(label);
  
  QComboBox *portCombo = new QComboBox(dialog);
  portCombo->setStyleSheet("QComboBox { background-color: white; color: black; border: 1px solid #b1b1b1; padding: 5px; } QComboBox::drop-down { border: none; } QComboBox::down-arrow { image: none; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid black; } QComboBox QAbstractItemView { background-color: white; color: black; selection-background-color: #0078d4; selection-color: white; }");
  for (const QJsonValue &value : m_serialPorts) {
    QJsonObject port = value.toObject();
    portCombo->addItem(port["path"].toString());
  }
  layout->addWidget(portCombo);
  
  QHBoxLayout *buttonLayout = new QHBoxLayout();
  QPushButton *connectButton = new QPushButton("Connect", dialog);
  QPushButton *cancelButton = new QPushButton("Cancel", dialog);
  
  buttonLayout->addWidget(connectButton);
  buttonLayout->addWidget(cancelButton);
  layout->addLayout(buttonLayout);
  
  // Connect signals
  connect(connectButton, &QPushButton::clicked, [this, dialog, portCombo]() {
    QString selectedPort = portCombo->currentText();
    connectToSelectedPort(selectedPort);
    dialog->accept();
  });
  
  connect(cancelButton, &QPushButton::clicked, dialog, &QDialog::reject);
  
  dialog->exec();
}

void BlinkBoardWidget::connectToSelectedPort(const QString &portPath) {
  qDebug() << "🔌 Connecting to BlinkBoard on port:" << portPath;
  
  addChatMessage(QString("Connecting to BlinkBoard on %1...").arg(portPath), false);
  
  // Send connection command to backend with selected port
  QJsonObject jsonCommand;
  jsonCommand["command"] = "blinkboard_connect";
  jsonCommand["selectedPort"] = portPath;
  jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
  
  QJsonDocument doc(jsonCommand);
  QString jsonString = doc.toJson(QJsonDocument::Compact);
  
  qDebug() << "Sending BlinkBoard connection command:" << jsonString;
  m_nodeProcess->write(jsonString.toUtf8() + "\n");
}

void BlinkBoardWidget::handleBlinkBoardConnectionRequest() {
  qDebug() << "🔌 BlinkBoard connection requested from TestWidget";
  
  // Add a chat message about the connection request
  addChatMessage("BlinkBoard connection requested from Test Widget", false);
  
  if (m_nodeProcess->state() == QProcess::Running) {
    if (m_serialPorts.isEmpty()) {
      // No ports available, request fresh list
      addChatMessage("No serial ports available. Requesting fresh list...", false);
      sendCommandToNode("get_serial_ports");
    } else {
      // Show port selection dialog
      showPortSelectionDialog();
    }
  } else {
    addChatMessage("Cannot connect to BlinkBoard - Node.js backend not running", false);
  }
}

void BlinkBoardWidget::handleTestsReceived(const QJsonArray &tests) {
  qDebug() << "🧪 Received" << tests.size() << "test groups from backend";
  
  // Emit a signal that TestWidget can listen to
  // This will be connected in the main application
  emit testsReceived(tests);
}

void BlinkBoardWidget::requestTestsFromBackend() {
  if (m_nodeProcess->state() == QProcess::Running) {
    qDebug() << "Requesting tests from backend...";
    sendCommandToNode("get_test_groups");
  } else {
    qDebug() << "Cannot request tests - Node.js backend not running";
  }
}

void BlinkBoardWidget::handleFunctionCalling() {
  qDebug() << "🚀 Function calling from backend";
  // TODO: Implement function calling

   addChatMessage("adding tests...", false);
}

// Simple streaming status handling methods
void BlinkBoardWidget::handleStreamingStart() {
  qDebug() << "🚀 AI response generation started - showing loading indicator";
  
  // Show the loading indicator
  m_loadingIndicator->show();
  m_loadingIndicator->setStyleSheet("QLabel { background-color: #2196F3; border-radius: 8px; }");
  m_loadingIndicator->setToolTip("AI is generating response...");
  
  // Start the loading animation
  m_loadingAnimationTimer->start();
  
  // Add a placeholder message
  addChatMessage("thinking...", false);
}

void BlinkBoardWidget::handleStreamingDone() {
  qDebug() << "✅ AI response generation completed - hiding loading indicator";
  
  // Stop the loading animation
  m_loadingAnimationTimer->stop();
  
  // Hide the loading indicator
  m_loadingIndicator->hide();
    
  // Auto-scroll to bottom
  QTextCursor cursor = m_chatDisplay->textCursor();
  cursor.movePosition(QTextCursor::End);
  m_chatDisplay->setTextCursor(cursor);
}

void BlinkBoardWidget::submitTestResultsToBackend(const QString &groupId, const QJsonObject &results)
{
  if (m_nodeProcess->state() != QProcess::Running) {
    addChatMessage("Not connected to backend. Cannot submit test results.", false);
    return;
  }

  // Create command to send test results to backend
  QJsonObject jsonCommand;
  jsonCommand["command"] = "submit_test_results";
  jsonCommand["groupId"] = groupId;
  jsonCommand["results"] = results;
  jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
  
  QJsonDocument doc(jsonCommand);
  QString jsonString = doc.toJson(QJsonDocument::Compact);
  
  qDebug() << "📝 Sending test results to Node.js backend:" << jsonString.left(200) + "...";
  m_nodeProcess->write(jsonString.toUtf8() + "\n");
  
  addChatMessage("submitted tests results for group " + groupId, false);
}

void BlinkBoardWidget::handleBlinkRequest(const QJsonObject &test, const QString &action)
{
  if (m_nodeProcess->state() != QProcess::Running) {
    addChatMessage("Not connected to backend. Cannot send blink command.", false);
    return;
  }

  // Create command to send blink request to backend
  QJsonObject jsonCommand;
  jsonCommand["command"] = "blink_request";
  jsonCommand["test"] = test;
  jsonCommand["action"] = action;
  jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
  
  QJsonDocument doc(jsonCommand);
  QString jsonString = doc.toJson(QJsonDocument::Compact);
  
  qDebug() << "🔘 Sending blink request to Node.js backend:" << jsonString.left(200) + "...";
  m_nodeProcess->write(jsonString.toUtf8() + "\n");
  
  addChatMessage("Blink command sent to backend.", false);
}
