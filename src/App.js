import React, { Component } from "react";
import {hot} from "react-hot-loader";
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as knnClassifier from '@tensorflow-models/knn-classifier';
import "./App.css";

class CountdownTimer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      value: 3
    };
  }

  async timer() {
    var remainingTime = 3;
    while (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      remainingTime -= 1;
      this.setState({
        value: remainingTime
      });
    }
  }

  componentDidMount() {
    this.timer();
  }

  render() {
    return (
      <div className="buttons">
        {this.state.value}
      </div>
    );
  }
}

class AnswerCard extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="buttons">
        <h1>{this.props.message}</h1>
        <button onClick={this.props.onClick}>OK</button>
      </div>
    );
  }
}

class InstructionCard extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="buttons">
        <h1>{this.props.message.mainText}</h1>
        <p>{this.props.message.subText}</p>
        <button onClick={this.props.onClick}>{this.props.message.buttonText}</button>
      </div>
    );
  }
}

class MessageCard extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    let card;
    if (!this.props.showCard && this.props.showCounter) {
      return <CountdownTimer />;
    } else if (!this.props.showCard && !this.props.showCounter) {
      return '';
    }
    card = this.props.isAnswer ? (
      <AnswerCard message={this.props.output} onClick={this.props.onButtonClick} />
    ) : (<InstructionCard message={this.props.output} onClick={this.props.onButtonClick} />
    );

    return (
      <div className="content">
        {card}
      </div>
    );
  }

}

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      output: '',
      cardCount: 0,
      showCard: true,
      freeze: true
    };
    this.messageBoardDetails = {
      0: {
        mainText: "Let's play Rock Paper Scissors!",
        subText: "click start to begin",
        buttonText: "Start"
      },
      1: {
        mainText: "First, show me a rock please.",
        subText: "close your fist and move it around the screen until next instruction",
        buttonText: "Continue"
      },
      2: {
        mainText: "Cool! Now, can you show me paper?",
        subText: "slowly wave your hand with your palm facing the camera",
        buttonText: "Continue"
      },
      3: {
        mainText: "It's not ok to play with scissors but can you show me what it looks like just this once.. pretty pleeeeeeeeese.",
        subText: "hold out your index and middle fingers and wave your hand slowly",
        buttonText: "Continue"
      },
      4: {
        mainText: "Awesome! Let's start!",
        subText: "",
        buttonText: "OK"
      }
    }
    this.handleIntructionClick = this.handleIntructionClick.bind(this);
    this.handleAnswerClick = this.handleAnswerClick.bind(this);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitAndAddExample(count) {
    for (var i=0; i<20; i++) {
      this.addExample(count);
      await this.sleep(100);
    }
    this.setState({
      showCard: true,
    });
  }

  async foreverLoop() {
    while(true) {
      this.classify();
      await tf.nextFrame();
    }
  }

  async usersTurn() {
    this.setState({
      showCounter: true
    });
    await this.sleep(4000);
    this.setState({
      showCard: true,
      showCounter: false,
      freeze: true
    });
  }

  handleIntructionClick(e) {
    e.preventDefault();
    this.setState({
      cardCount: this.state.cardCount + 1,
      showCard: false
    });

    if (this.state.cardCount > 0 && this.state.cardCount < 4) {
      this.waitAndAddExample(this.state.cardCount - 1);
    } else {
      this.setState({
        showCard: true,
      });
    }

  }

  handleAnswerClick(e) {
    e.preventDefault();
    this.setState({
      cardCount: this.state.cardCount + 1,
      showCard: false,
      freeze: false,
      showCounter: false
    });
    this.usersTurn();
  }

  async setupWebcam() {
    return new Promise((resolve, reject) => {
      const navigatorAny = navigator;
      navigator.getUserMedia = navigator.getUserMedia ||
          navigatorAny.webkitGetUserMedia || navigatorAny.mozGetUserMedia ||
          navigatorAny.msGetUserMedia;
      if (navigator.getUserMedia) {
        navigator.getUserMedia({video: true},
          stream => {
            this.webcamElement.srcObject = stream;
            this.webcamElement.addEventListener('loadeddata',  () => resolve(), false);
          },
          error => reject());
      } else {
        reject();
      }
    });
  }

  addExample(classId) {
    // Get the intermediate activation of MobileNet 'conv_preds' and pass that
    // to the KNN classifier.
    const activation = this.net.infer(this.webcamElement, 'conv_preds');
    // Pass the intermediate activation to the classifier.
    this.classifier.addExample(activation, classId);
  }

  async rpc() {
    // Reads an image from the webcam and associates it with a specific class
    // index.
    await this.loadNet();

    this.foreverLoop();
  }

  async loadNet() {
    console.log('Loading mobilenet..');

    // Load the model.
    this.net = await mobilenet.load();
    console.log('Sucessfully loaded model');
    await this.setupWebcam();
  }

  async classify() {
    if (this.classifier.getNumClasses() > 0) {
      // Get the activation from mobilenet from the webcam.
      const activation = this.net.infer(this.webcamElement, 'conv_preds');

      // Get the most likely class and confidences from the classifier module.
      const result = await this.classifier.predictClass(activation);

      const classes = ['Rock', 'Paper', 'Scissor'];

      const output = {
        Rock: 'Paper',
        Paper: 'Scissor',
        Scissor: 'Rock'
      };

      if (!this.state.freeze) {
        this.setState({
          output: output[classes[result.classIndex]]
        });
      }

    }
  }

  componentDidMount() {

    this.classifier = knnClassifier.create();

    this.webcamElement = document.getElementById('webcam');

    this.rpc();
  }

  render() {
    let messageOutput, answer, buttonClick;
    if (this.state.cardCount < 4) {
      messageOutput = this.messageBoardDetails[this.state.cardCount];
      answer = false;
      buttonClick = this.handleIntructionClick;
    } else {
      messageOutput = this.state.output;
      answer = true;
      buttonClick = this.handleAnswerClick;
    }

    return(
      <div className="video-container">
        <div id="console"></div>
        <video autoPlay playsInline muted id="webcam" width="100%" height="100%"></video>
        <MessageCard output={messageOutput}
                     isAnswer={answer}
                     onButtonClick={buttonClick}
                     showCard={this.state.showCard}
                     showCounter={this.state.showCounter} />
      </div>
    );
  }
}

export default hot(module)(App);
