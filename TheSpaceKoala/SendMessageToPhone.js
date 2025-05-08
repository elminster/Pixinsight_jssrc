// ==================================================================================
// SendMessageToPhone.js - A PixInsight script to process an image and send it to Telegram or iMessage
//
// Copyright (c) 2025 Luca Bartek
//
// Send Message To Phone
// Author: Luca Bartek
// Website: www.thespacekoala.com
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// ==================================================================================

#feature-id SendMessageToPhone : TheSpaceKoala > SendImageToPhone
#feature-icon  messageIcon.svg
#feature-info  This script processes the active image and sends it to your phone via the selected service.
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/DataType.jsh>
#include "KoalaUtils.js"
#include "SendMessageToIMessage.js"
#include "SendMessageToTelegram.js"


#define TITLE "Send Image To Phone"
#define VERSION "V1.0.2" //20250506


var PLATFORMS = {
  TELEGRAM: 1,
  IMESSAGE: 2,
};

if (typeof SendMessageToPhoneConstants === 'undefined') {
  var SendMessageToPhoneConstants = {
    PHONE_PLATFORM_KEY: 'SendMessageToPhone/platform',
    TELEGRAM_TOKEN_KEY: 'SendMessageToPhone/telegramBotToken',
    TELEGRAM_CHAT_ID_KEY: 'SendMessageToPhone/telegramChatId',
    MESSAGE_KEY: 'SendMessageToPhone/message',
    IMESSAGE_RECIPIENT_KEY: 'SendMessageToPhone/imessageRecipient',
    DO_STRETCH_KEY: 'SendMessageToPhone/doStretch',
    LINKED_KEY: 'SendMessageToPhone/linked',
  };
}

// ==== Settings handling ====

function loadPhoneSettings() {
      return {
    platform:
      Settings.read(
        SendMessageToPhoneConstants.PHONE_PLATFORM_KEY,
        DataType_Int32
      ) || PLATFORMS.TELEGRAM,
    telegramBotToken:
      Settings.read(
        SendMessageToPhoneConstants.TELEGRAM_TOKEN_KEY,
        DataType_UCString
      ) || '',
    telegramChatId: (function () {
      var v = Settings.read(
        SendMessageToPhoneConstants.TELEGRAM_CHAT_ID_KEY,
        DataType_UCString
      );
      return typeof v === 'undefined' ? 0 : v;
    })(),
    message:
      Settings.read(
        SendMessageToPhoneConstants.MESSAGE_KEY,
        DataType_UCString
      ) || ':)',
    imessageRecipient:
      Settings.read(
        SendMessageToPhoneConstants.IMESSAGE_RECIPIENT_KEY,
        DataType_UCString
      ) || '',
  };
}

function savePhoneSettings(data) {
  // Save the platform, Telegram credentials, iMessage recipient, message, doStretch, and linked settings
  Settings.write(SendMessageToPhoneConstants.PHONE_PLATFORM_KEY, DataType_Int32, data.platform);
  Settings.write(SendMessageToPhoneConstants.TELEGRAM_TOKEN_KEY, DataType_UCString, data.telegramBotToken);
  Settings.write(SendMessageToPhoneConstants.TELEGRAM_CHAT_ID_KEY, DataType_UCString, data.telegramChatId.toString());
  Settings.write(SendMessageToPhoneConstants.MESSAGE_KEY, DataType_UCString, data.message);
  Settings.write(SendMessageToPhoneConstants.IMESSAGE_RECIPIENT_KEY, DataType_UCString, data.imessageRecipient);
  Settings.write(SendMessageToPhoneConstants.DO_STRETCH_KEY, DataType_Boolean, data.doStretch);
  Settings.write(SendMessageToPhoneConstants.LINKED_KEY, DataType_Boolean, data.linked);
}

function resetPhoneSettings() {
  // Reset saved settings to their default values
  Settings.remove(SendMessageToPhoneConstants.PHONE_PLATFORM_KEY);
  Settings.remove(SendMessageToPhoneConstants.TELEGRAM_TOKEN_KEY);
  Settings.remove(SendMessageToPhoneConstants.TELEGRAM_CHAT_ID_KEY);
  Settings.remove(SendMessageToPhoneConstants.MESSAGE_KEY);
  Settings.remove(SendMessageToPhoneConstants.IMESSAGE_RECIPIENT_KEY);
  Settings.remove(SendMessageToPhoneConstants.DO_STRETCH_KEY);
  Settings.remove(SendMessageToPhoneConstants.LINKED_KEY);
}

function sendMessage(
  platform,
  telegramToken,
  telegramChatId,
  imessageRecipient,
  message
) {

 if (platform === PLATFORMS.TELEGRAM) {
    sendMessageToTelegram(
      telegramToken,
      telegramChatId,
      message
    );
  } else if (platform === PLATFORMS.IMESSAGE) {
    sendMessageToIMessage(
      imessageRecipient,
      message
    );
  } else {
    printError('Please configure platform in the SendMessageToPhone script');
  }
}

function sendImage(
  targetWindow,
  platform,
  telegramToken,
  telegramChatId,
  imessageRecipient,
  message,
  doStretch,  // Added doStretch
  linked      // Added linked
) {

 if (platform === PLATFORMS.TELEGRAM) {
  // For Telegram, use telegramToken and telegramChatId
    processAndSendImageToTelegram(
      targetWindow,
      telegramToken, // Telegram Bot Token
      telegramChatId, // Telegram Chat ID
      message, // Message text (shared for both platforms)
      doStretch, // Pass doStretch
      linked // Pass linked
    );
  } else if (platform === PLATFORMS.IMESSAGE) {
    // For iMessage, use imessageRecipient
    processAndSendImageToIMessage(
      targetWindow,
      imessageRecipient, // iMessage recipient
      message, // Message text (shared for both platforms)
      doStretch, // Pass doStretch
      linked // Pass linked
    );
  } else {
    printError('Unknown platform!');
  }
}
// ==== Main Dialog ====

function SendMessageToPhoneDialog() {
  this.__base__ = Dialog;
  this.__base__();

  this.windowTitle = 'Send Message to Phone';

  var self = this;
  var labelWidth = this.logicalPixelsToPhysical(120);

  // Load saved settings
  var savedConfig = loadPhoneSettings();

  this.sizer = new VerticalSizer();
  this.sizer.margin = 10;
  this.sizer.spacing = 6;

  // === Platform Selection ===
  this.platformGroupBox = new GroupBox(this);
  this.platformGroupBox.title = 'Choose Platform';
  this.platformGroupBox.sizer = new VerticalSizer();
  this.platformGroupBox.sizer.margin = 6;
  this.platformGroupBox.sizer.spacing = 4;

  this.telegramRadio = new RadioButton(this.platformGroupBox);
  this.telegramRadio.text = 'Telegram';
  this.telegramRadio.checked = savedConfig.platform === PLATFORMS.TELEGRAM;

  this.imessageRadio = new RadioButton(this.platformGroupBox);
  this.imessageRadio.text = 'iMessage';
  this.imessageRadio.checked = savedConfig.platform === PLATFORMS.IMESSAGE;

  if (CoreApplication.platform != 'macOS') {
    this.imessageRadio.enabled = false;
  }

  this.platformGroupBox.sizer.add(this.telegramRadio);
  this.platformGroupBox.sizer.add(this.imessageRadio);
  this.sizer.add(this.platformGroupBox);

  // === Telegram Configuration ===
  this.telegramGroupBox = new GroupBox(this);
  this.telegramGroupBox.title = 'Telegram Configuration';
  this.telegramGroupBox.sizer = new VerticalSizer();
  this.telegramGroupBox.sizer.margin = 6;
  this.telegramGroupBox.sizer.spacing = 4;

  var telegramTokenSizer = new HorizontalSizer();
  this.telegramTokenLabel = new Label(this.telegramGroupBox);
  this.telegramTokenLabel.text = 'Bot Token:';
  this.telegramTokenLabel.minWidth = labelWidth;
  this.telegramTokenLabel.textAlignment =
    TextAlign_Right | TextAlign_VertCenter;

  this.telegramTokenInput = new Edit(this.telegramGroupBox);
  this.telegramTokenInput.text = savedConfig.telegramBotToken;

  telegramTokenSizer.spacing = 4;
  telegramTokenSizer.add(this.telegramTokenLabel);
  telegramTokenSizer.add(this.telegramTokenInput, 100);
  this.telegramGroupBox.sizer.add(telegramTokenSizer);

  var telegramChatIdSizer = new HorizontalSizer();
  this.telegramChatIdLabel = new Label(this.telegramGroupBox);
  this.telegramChatIdLabel.text = 'Chat ID:';
  this.telegramChatIdLabel.minWidth = labelWidth;
  this.telegramChatIdLabel.textAlignment =
    TextAlign_Right | TextAlign_VertCenter;

  this.telegramChatIdInput = new NumericEdit(this.telegramGroupBox);
  this.telegramChatIdInput.setRange(
    -9223372036854775808,
    9223372036854775807
  );
  this.telegramChatIdInput.setPrecision(0);
   if (typeof savedConfig.telegramChatId !== 'undefined' && savedConfig.telegramChatId !== null) {
       this.telegramChatIdInput.setValue(savedConfig.telegramChatId.toNumber());
   } else {
       this.telegramChatIdInput.setValue(Number.NaN);
   }

  // Fix the alignment: hide the internal label and set width
  this.telegramChatIdInput.label.visible = false;
  this.telegramChatIdInput.setFixedWidth(150); // Align width with other fields

  telegramChatIdSizer.spacing = 4;
  telegramChatIdSizer.add(this.telegramChatIdLabel);
  telegramChatIdSizer.add(this.telegramChatIdInput, 100);
  this.telegramGroupBox.sizer.add(telegramChatIdSizer);

  this.sizer.add(this.telegramGroupBox);


// === iMessage Configuration ===
this.imessageGroupBox = new GroupBox(this);
this.imessageGroupBox.title = 'iMessage Configuration';
this.imessageGroupBox.sizer = new VerticalSizer();
this.imessageGroupBox.sizer.margin = 6;
this.imessageGroupBox.sizer.spacing = 4;

var imessageRecipientSizer = new HorizontalSizer();
this.imessageRecipientLabel = new Label(this.imessageGroupBox);
this.imessageRecipientLabel.text = 'Recipient:';
this.imessageRecipientLabel.minWidth = labelWidth;
this.imessageRecipientLabel.textAlignment =
  TextAlign_Right | TextAlign_VertCenter;

this.imessageRecipientInput = new Edit(this.imessageGroupBox);
this.imessageRecipientInput.text = savedConfig.imessageRecipient;

imessageRecipientSizer.spacing = 4;
imessageRecipientSizer.add(this.imessageRecipientLabel);
imessageRecipientSizer.add(this.imessageRecipientInput, 100);
this.imessageGroupBox.sizer.add(imessageRecipientSizer);

// === Message Field ===
this.messageGroupBox = new GroupBox(this);
this.messageGroupBox.title = 'Message';
this.messageGroupBox.sizer = new VerticalSizer();
this.messageGroupBox.sizer.margin = 6;
this.messageGroupBox.sizer.spacing = 6;  // Increased spacing

var messageSizer = new HorizontalSizer();
this.messageLabel = new Label(this.messageGroupBox);
this.messageLabel.text = 'Message Text:';
this.messageLabel.minWidth = labelWidth;
this.messageLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

this.messageInput = new Edit(this.messageGroupBox);
this.messageInput.text = savedConfig.message;

messageSizer.spacing = 4;
messageSizer.add(this.messageLabel);
messageSizer.add(this.messageInput, 100);
this.messageGroupBox.sizer.add(messageSizer);

// === Auto-Stretch Checkbox (Inside Message Group Box) ===
this.doStretchCheckbox = new CheckBox(this.messageGroupBox);
this.doStretchCheckbox.text = 'Auto-Stretch';
this.doStretchCheckbox.checked = savedConfig.doStretch || false;

var autoStretchSizer = new HorizontalSizer();
autoStretchSizer.spacing = 4;
autoStretchSizer.addSpacing(20);
autoStretchSizer.add(this.doStretchCheckbox);
autoStretchSizer.addStretch();

// === Linked Checkbox (Only Active When Auto-Stretch is Enabled) ===
this.linkedCheckbox = new CheckBox(this.messageGroupBox);
this.linkedCheckbox.text = 'Linked Channels';
this.linkedCheckbox.checked = savedConfig.linked || false;
this.linkedCheckbox.enabled = this.doStretchCheckbox.checked; // Initially enabled based on auto-stretch

var linkedSizer = new HorizontalSizer();
linkedSizer.spacing = 4;
linkedSizer.addSpacing(20);
linkedSizer.add(this.linkedCheckbox);
linkedSizer.addStretch();

// === Toggle Linked Checkbox Based on Auto-Stretch ===
var self = this;
this.doStretchCheckbox.onCheck = function (checked) {
  self.linkedCheckbox.enabled = checked;
};

// Add the checkboxes to the Message Group Box with better spacing
this.messageGroupBox.sizer.add(autoStretchSizer);
this.messageGroupBox.sizer.add(linkedSizer);

// Add the message group box to the main sizer
this.sizer.add(this.imessageGroupBox);
this.sizer.add(this.messageGroupBox);

  // === Buttons ===

  // === New Instance Button ===
  this.newInstanceButton = new ToolButton(this);
  this.newInstanceButton.icon = this.scaledResource(
    ':/process-interface/new-instance.png'
  ); // Set the triangle icon
  this.newInstanceButton.setScaledFixedSize(24, 24); // Set the size
  this.newInstanceButton.toolTip = 'New Instance'; // Tooltip text

  this.runButton = new PushButton(this);
  this.runButton.text = 'Send';
  this.runButton.icon = this.scaledResource(':/icons/power.png');

  this.cancelButton = new PushButton(this);
  this.cancelButton.text = 'Cancel';
  this.cancelButton.icon = this.scaledResource(':/icons/close.png');

  this.saveParamsButton = new PushButton(this); // Save Parameters button
  this.saveParamsButton.text = 'Save Parameters'; // Set button text
  this.saveParamsButton.icon = this.scaledResource(
    ':/process-interface/save.png'
  ); // Set icon

// === Reset Parameters Button ===
this.resetButton = new PushButton(this);
this.resetButton.text = 'Reset Parameters';
this.resetButton.icon = this.scaledResource(':/process-interface/reset.png'); // Add an icon if needed


  var buttonSizer = new HorizontalSizer();
  buttonSizer.spacing = 8;
  buttonSizer.add(this.newInstanceButton); // Add New Instance button here
  buttonSizer.addStretch();
  buttonSizer.add(this.runButton);
  buttonSizer.add(this.saveParamsButton); // Add Save Parameters button here
  buttonSizer.add(this.resetButton);
  buttonSizer.add(this.cancelButton);

  this.sizer.addSpacing(10);
  this.sizer.add(buttonSizer);

  // === Platform Toggle ===
  this.updatePlatformVisibility = function () {
    var isTelegram = self.telegramRadio.checked;
    self.telegramGroupBox.enabled = isTelegram;
    self.imessageGroupBox.enabled = !isTelegram;
  };

  this.telegramRadio.onCheck = this.updatePlatformVisibility;
  this.imessageRadio.onCheck = this.updatePlatformVisibility;
  this.updatePlatformVisibility();

  // Function to retrieve all field values and return them as an object
// Function to retrieve all field values and return them as an object
function getFormData() {
  // Determine selected platform dynamically
  var selectedPlatform = null;

  if (self.telegramRadio.checked) {
    selectedPlatform = PLATFORMS.TELEGRAM;
  } else if (self.imessageRadio.checked) {
    selectedPlatform = PLATFORMS.IMESSAGE;
  }

  return {
    platform: selectedPlatform,
    telegramBotToken: self.telegramTokenInput.text.trim(),
    telegramChatId: self.telegramChatIdInput.value,
    message: self.messageInput.text.trim(),
    imessageRecipient: self.imessageRecipientInput.text.trim(),
    doStretch: self.doStretchCheckbox.checked, // Added doStretch parameter
    linked: self.linkedCheckbox.checked // Added linked parameter
  };
}

  // === Wire Buttons ===
  // === "New Instance" Button (Triangle Icon) ===
  var self = this;
  this.newInstanceButton.onMousePress = function () {
    var P = new Object();

    // Save all parameters into P
  var data = getFormData(); // Retrieve all data from the form

  // Store parameters in the instance
  Parameters.clear();
  for (var key in data) {
    if (data[key] !== undefined) {
      Parameters.set(key, data[key]);
    }
  }
    self.newInstance();
  };

  // In the run button event, when the user selects iMessage, we use the function
this.runButton.onClick = function () {
  // Retrieve form data
  var data = getFormData();

  // Call sendImage with the retrieved form data
  sendImage(
    ImageWindow.activeWindow, // Assuming the image window is the target
    data.platform,
    data.telegramBotToken,  // For Telegram
    data.telegramChatId,    // For Telegram
    data.imessageRecipient, // For iMessage
    data.message,           // Message for both platforms
    data.doStretch,         // doStretch parameter
    data.linked             // linked parameter
  );

  self.ok();
};

  this.cancelButton.onClick = function () {
    self.cancel();
  };

// === Save Parameters Button ===
this.saveParamsButton.onClick = function () {
  // Get all field values from the form
  var data = getFormData();  // Use the getFormData function to retrieve the values

  // Save the parameters
  savePhoneSettings(data);

  // Notify user that parameters have been saved
  Console.noteln("Parameters have been saved successfully.");

  // Show a confirmation dialog
raiseInfo("Parameters saved successfully!");
};

// === Reset Parameters Button ===
this.resetButton.onClick = function () {
  // Reset all fields to default values
  self.telegramTokenInput.text = '';
  self.telegramChatIdInput.setValue(0);
  self.imessageRecipientInput.text = '';
  self.messageInput.text = ':)';
  self.doStretchCheckbox.checked = false;
  self.linkedCheckbox.checked = false;

  // Reset platform selection to default (Telegram)
  self.telegramRadio.checked = true;
  self.imessageRadio.checked = false;

  // Reset settings in the memory
  resetPhoneSettings();  // Reset stored settings

  Console.noteln("Settings have been reset to default.");
};

  this.adjustToContents();
}

SendMessageToPhoneDialog.prototype = new Dialog();

// ==== Main Program ====
function main() {
 // printTheSpaceKoalaBanner();

  // If the process was dragged onto an image, execute immediately without opening the GUI
  if (Parameters.isViewTarget) {
    let targetWindow = Parameters.targetView.window;

    if (!targetWindow.isNull) {
      // Retrieve parameters from Parameters storage
      var platform = parseInt(Parameters.get('platform'), 10);  // Telegram or iMessage
      var token = Parameters.get('telegramBotToken');  // Telegram Bot Token
      var telegramChatId = parseInt(Parameters.get('telegramChatId'), 10);  // Telegram Chat ID
      var message = Parameters.get('message');  // Message Text
      var imessageRecipient = Parameters.get('imessageRecipient');  // iMessage Recipient
      var doStretch = (Parameters.get('doStretch') || "").trim().toLowerCase() === "true";
      var linked = (Parameters.get('linked') || "").trim().toLowerCase() === "true";
      // Send the image depending on the platform
      sendImage(
        targetWindow,
        platform,
        token,
        telegramChatId,
        imessageRecipient,
        message,
        doStretch,  // Include the doStretch parameter
        linked  // Include the linked parameter
      );
    } else {
      printError('No valid target image found.');
    }
    return;  // Exit after processing the target image
  }

  // Otherwise: Open the GUI for user input
  let dialog = new SendMessageToPhoneDialog();

  if (!dialog.execute()) {
    printInfo('User canceled the script.');
    return;
  }
}

main();
