import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Image, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import * as FaceDetector from 'expo-face-detector';
import Voice from '@react-native-community/voice';
import Tts from 'react-native-tts';

import { NlpManager } from 'node-nlp-rn';
import moment from 'moment';
import Amplify, { Auth }  from 'aws-amplify';
import awsconfig from './aws-exports';
import axios from "axios"
import { Spinner } from 'native-base';
//import loadLocalResource from 'react-native-local-resource';

import { withAuthenticator } from './components/Authentication';

const TIMER_VISITOR_DECTION_RATE = 1000;

Amplify.configure({
  ...awsconfig,
  Analytics: {
    disabled: true,
  },
});


axios.defaults.baseURL = "https://projetkhiron.com:3000";

axios.interceptors.request.use(function (config) {
    return Auth.currentSession()
      .then(session => {
        // User is logged in. Set auth header on all requests
        config.headers.Authorization = 'Bearer ' + session.getAccessToken().getJwtToken();
        return Promise.resolve(config)
      })
      .catch(() => {
        // No logged-in user: don't set auth header
        return Promise.resolve(config)
      })
}) 

function debugMsg(...args: any[]) {
  console.log(...args);
}

const globalAny:any = global

function App() {
  useKeepAwake();

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [audioPermissionsGranted, setAudioPermissionsGranted] = useState(false);
  //const [barCodePermissionsGranted, setBarCodePermissionsGranted] = useState(false);
  const [foundFaces, setFoundFaces] = useState([]);

  const camera = useRef(null);

  const [loadingNlp, setLoadingNlp] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingTTS, setLoadingTTS] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  //const [loadingBarCode, setLoadingBarCode] = useState(false);
  //const [loadingAudioFiles, setLoadingAudioFiles] = useState(false);

  const [visitingFloor, setVisitingFloor] = useState(null);
  const [visitingRoom, setVisitingRoom] = useState(null);
  
  const [listeningForAnswer, setListeningForAnswer] = useState(false);

  const [someonesThere, setSomeonesThere] = useState(false);

  const [floorDetails, setFloorDetails] = useState(null);
  const [visitorSettings, setVisitorSettings] = useState(null);
  const [newRequestOptions, setNewRequestOptions] = useState<any>([]);
  const [newRequestOptionsText, setNewRequestOptionsText] = useState<any>([]);
  const [visitorDestination, setVisitorDestination] = useState(null);

  useEffect(() => {
    setLoadingNlp(true);
    setLoadingCamera(true);
    setLoadingAudio(true);
    setLoadingTTS(true);
    setLoadingSettings(true);
    //setLoadingBarCode(true);
    //setLoadingAudioFiles(true);

    Voice.isAvailable().then(_results => {
      debugMsg("Voice recognition system is available");
    }).catch((err: any) => {
      debugMsg("Voice recognition system is not available");
      debugMsg(err.message, err.code);
    });


    Tts.getInitStatus().then(() => {
      debugMsg("Text to speech system is available");
      setLoadingTTS(false);
    }, (err:any) => {
      debugMsg("Text to speech system is not available");
      debugMsg(err.message, err.code);
      if (err.code === 'no_engine') {
        Tts.requestInstallEngine();
      }
    }).finally(() => {
      Tts.setDucking(true);
      Tts.setDefaultLanguage('fr-CA');
      Tts.setIgnoreSilentSwitch("ignore");
      Tts.voices().then((voices:any) => {
        const availableVoices = voices.filter((v:any) => !v.networkConnectionRequired && !v.notInstalled && v.language === "fr-CA");
        if(availableVoices && availableVoices.length >0) {
          debugMsg("Setting default text to speech voice to "+availableVoices[0].name);
          Tts.setDefaultVoice(availableVoices[0].id);
        }
      });
    });

    Tts.addEventListener('tts-start', onTTSStart);
    Tts.addEventListener('tts-finish',onTTSFinish);
    Tts.addEventListener('tts-cancel', onTTSCancel);


    // debugMsg("Importing NLP Model");
    // loadLocalResource(nlpModel).then(nlpModelStr => {
    //   debugMsg("Resource model file loaded, importing model.");
    //   // var nlp = new NlpManager();
    //   // nlp.import(nlpModelStr);
    //   // globalAny.nlp = nlp;
    //   // setLoadingNlp(false);
    //   // debugMsg("Done importing NLP");
    //   // nlp.process('fr', "je m'en vais au deuxième étage").then(response => {
    //   //   debugMsg("Test NLP String process passed")
    //   // }).catch((err: any) => {
    //   //   debugMsg("Failed test NLP String process");
    //   //   debugMsg(err.message, err.code);
    //   // })

      const nlp = new NlpManager({ languages: ['fr'], forceNER: true, nlu: { useNoneFeature: false }});
      (async () => {
        nlp.addNamedEntityText('article','le',['fr'],['le'],);
        nlp.addNamedEntityText('article','la',['fr'],['la'],);
        nlp.addNamedEntityText('article','les',['fr'],['les'],);
        nlp.addNamedEntityText('article',"l'",['fr'],["l'"],);
        nlp.addNamedEntityText('article','au',['fr'],['au'],);
        nlp.addNamedEntityText('article','aux',['fr'],['aux'],);
        nlp.addNamedEntityText('article','de',['fr'],['de'],);
        nlp.addNamedEntityText('article','du',['fr'],['du'],);
        nlp.addNamedEntityText('article','des',['fr'],['des'],);
        nlp.addNamedEntityText('article','ce',['fr'],['ce'],);
        nlp.addNamedEntityText('article','se',['fr'],['se'],);
        nlp.addNamedEntityText('article','ces',['fr'],['ces'],);
        nlp.addNamedEntityText('article','ses',['fr'],['ses'],);
        nlp.addNamedEntityText('article',"c'",['fr'],["c'"],);
        nlp.addNamedEntityText('article',"s'",['fr'],["s'"],);

        nlp.addDocument('fr', 'Bonjour', 'greeting.hello');
        nlp.addDocument('fr', 'Allo', 'greeting.hello');
        nlp.addDocument('fr', 'Salut', 'greeting.hello');

        nlp.addDocument('fr', 'ok, bye', 'greeting.bye');
        nlp.addDocument('fr', 'bye', 'greeting.bye');
        nlp.addDocument('fr', 'à la prochaine', 'greeting.bye');
        nlp.addDocument('fr', 'Salut, à la prochaine', 'greeting.bye');
        nlp.addDocument('fr', 'adieu', 'greeting.bye');
    
        nlp.addDocument('fr', 'oui', 'confirmation.positive');
        nlp.addDocument('fr', 'bien oui', 'confirmation.positive');
        nlp.addDocument('fr', 'ben oui', 'confirmation.positive');
        nlp.addDocument('fr', 'eh oui', 'confirmation.positive');
        nlp.addDocument('fr', 'ouin', 'confirmation.positive');
        nlp.addDocument('fr', 'hum ouin', 'confirmation.positive');
        nlp.addDocument('fr', "c'est ça", 'confirmation.positive');
        nlp.addDocument('fr', "en effet", 'confirmation.positive');
        nlp.addDocument('fr', "qu'est-ce tu pense", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit oui", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit bien oui", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit ben oui", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit eh oui", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit ouin", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit hum ouin", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit c'est ça", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit en effet", 'confirmation.positive');
        nlp.addDocument('fr', "J'ai dit qu'est-ce tu pense", 'confirmation.positive');

        nlp.addDocument('fr', "je sais pas", 'confirmation.unsure');
        nlp.addDocument('fr', "sais pas", 'confirmation.unsure');
        nlp.addDocument('fr', "je ne suis pas certain", 'confirmation.unsure');
        nlp.addDocument('fr', "pas certain", 'confirmation.unsure');
        nlp.addDocument('fr', "aucune idée", 'confirmation.unsure');
        nlp.addDocument('fr', "pas d'idée", 'confirmation.unsure');
        nlp.addDocument('fr', "j'en ai aucune idée", 'confirmation.unsure');
        nlp.addDocument('fr', "je sais pas", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit je sais pas", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit sais pas", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit je ne suis pas certain", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit pas certain", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit aucune idée", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit pas d'idée", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit j'en ai aucune idée", 'confirmation.unsure');
        nlp.addDocument('fr', "J'ai dit je sais pas", 'confirmation.unsure');

        nlp.addDocument('fr', "non", 'confirmation.negative');
        nlp.addDocument('fr', "eh non", 'confirmation.negative');
        nlp.addDocument('fr', "pas du tout", 'confirmation.negative');
        nlp.addDocument('fr', "pantoute", 'confirmation.negative');
        nlp.addDocument('fr', "J'ai dit non", 'confirmation.negative');
        nlp.addDocument('fr', "J'ai dit pas du tout", 'confirmation.negative');
        nlp.addDocument('fr', "J'ai dit pantoute", 'confirmation.negative');
    
        nlp.addDocument('fr', "Mon nom est %name%", 'identify.name');
        nlp.addDocument('fr', "Mon nom c'est %name%", 'identify.name');
        nlp.addDocument('fr', "Je m'appel %name%", 'identify.name');
        nlp.addDocument('fr', "Moi c'est %name%", 'identify.name');
        nlp.addDocument('fr', "c'est %name%", 'identify.name');

        nlp.addDocument('fr', "%floor% étage", 'identify.floor');
        nlp.addDocument('fr', "Je m'en vais au premier étage", 'identify.floor');
        nlp.addDocument('fr', "Je m'en vais au 1er étage", 'identify.floor');
        nlp.addDocument('fr', "Je m'en vais au deuxième étage", 'identify.floor');
        nlp.addDocument('fr', "Je m'en vais au %floor% étage", 'identify.floor');
        nlp.addDocument('fr', "Au %floor% étage", 'identify.floor');
        nlp.addDocument('fr', "Au %floor%", 'identify.floor');
        nlp.addDocument('fr', "Sur le %floor% étage", 'identify.floor');

        nlp.addDocument('fr', "c'est pas la bonne étage", 'change.floor');
        nlp.addDocument('fr', "mauvaise étage", 'change.floor');
        nlp.addDocument('fr', "c'est la mauvaise étage", 'change.floor');
        nlp.addDocument('fr', "l'étage", 'change.floor');
        nlp.addDocument('fr', "je veux modifier l'étage", 'change.floor');
        nlp.addDocument('fr', "je veux changer l'étage", 'change.floor');

        nlp.addDocument('fr', "c'est pas le bon nom", 'change.name');
        nlp.addDocument('fr', "c'est pas moi", 'change.name');
        nlp.addDocument('fr', "c'est le mauvais nom", 'change.name');
        nlp.addDocument('fr', "mon nom s'écrit pas comme ça", 'change.name');
        nlp.addDocument('fr', "je veux modifier le nom", 'change.name');
        nlp.addDocument('fr', "je veux modifier mon nom", 'change.name');
        nlp.addDocument('fr', "je veux changer le nom", 'change.name');
        nlp.addDocument('fr', "je veux changer mon nom", 'change.name');

        nlp.addDocument('fr', "c'est pas le bon numéro", 'change.phone');
        nlp.addDocument('fr', "le numéro est pas bon", 'change.phone');
        nlp.addDocument('fr', "c'est le mauvais numéro", 'change.phone');
        nlp.addDocument('fr', "je veux modifier le numéro", 'change.phone');
        nlp.addDocument('fr', "je veux modifier mon numéro", 'change.phone');
        nlp.addDocument('fr', "je veux changer le numéro", 'change.phone');
        nlp.addDocument('fr', "je veux changer mon numéro", 'change.phone');

        nlp.train().then((result: any) => {
          globalAny.nlp = nlp;
          debugMsg("Done training NLP");

          globalAny.nlp.process('fr', "Bon matin").then((response:any) => {
            setLoadingNlp(false);
          }).catch((err: any) => {
            debugMsg("Failed processing initial NLP request");
            debugMsg(err.message, err.code);
          });
        }).catch((err: any) => {
          debugMsg("Failed training NLP model");
          debugMsg(err.message, err.code);
        });

      })();

      let floorListReq = axios.get("/projetkhiron/floors");
      let visitorSettingsReq = axios.get("/projetkhiron/visitor/settings");
      axios.all([floorListReq, visitorSettingsReq])
      .then(
        axios.spread((...responses) => {
          const floorListRes = responses[0];
          const settingsRes = responses[1];
  
          if (floorListRes.status === 200) {
            setFloorDetails(floorListRes.data);
            debugMsg("Got all floor details");

            // let sectorOptions = [];
            // floorListRes.data.forEach( floor => {
            //   sectorOptions.push({label:floor.label, _id:floor._id, type:'floor'});
            //   if(floor.sections && floor.sections.length > 0 ) {
            //     floor.sections.forEach( section => {
            //       sectorOptions.push({label: " " + section.label, _id:section._id, floorID:floor._id, floorLabel:floor.label, type:'section'});
            //     });
            //   }
            // });
            // setLocationList(sectorOptions);
          } else {
            debugMsg("Failed retreiving list of floors");
            debugMsg(JSON.stringify(floorListRes));
          }
  
          if (settingsRes.status === 200) {
            setVisitorSettings(settingsRes.data.settings);
            debugMsg("Got all visitor settings");
          } else {
            debugMsg("Failed retreiving visitor settings");
            debugMsg(JSON.stringify(settingsRes));
          }
          setLoadingSettings(false);
        }
      ))
      .catch(err => {
        debugMsg("Failed retreiving flor details");
        debugMsg(err.message, err.code);
      });

    // }).catch((err: any) => {
    //   debugMsg("Failed loading NLP model");
    //   debugMsg(err.message, err.code);
    // });

    debugMsg("Requesting Audio Permissions");
    Audio.requestPermissionsAsync().then(audioPermissions => {
      setAudioPermissionsGranted((audioPermissions.status === 'granted'));
      debugMsg("Audio recording permission granted");
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
        shouldDuckAndroid: true,
        allowsRecordingIOS: false,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
        playThroughEarpieceAndroid: false
      }).then((result: any) => {
        setLoadingAudio(false);
        debugMsg("Audio Mode Set");
      }).catch((err: any) => {
        debugMsg("Failed Setting Audio Mode");
        debugMsg(err.message, err.code);
      });
    }).catch((err: any) => {
      debugMsg("Failed Requesting Audio Permissions");
      debugMsg(err.message, err.code);
    });

    // (async () => {
        
    //   globalAny.bonjourMsg = new Audio.Sound();
    //   globalAny.bonjourMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.bonjourMsg.loadAsync(require("./assets/bonjour.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading bonjour audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.etageMsg = new Audio.Sound();
    //   globalAny.etageMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.etageMsg.loadAsync(require("./assets/etage.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading etage audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.nomMsg = new Audio.Sound();
    //   globalAny.nomMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.nomMsg.loadAsync(require("./assets/nom.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading nom audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.telephoneMsg = new Audio.Sound();
    //   globalAny.telephoneMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.telephoneMsg.loadAsync(require("./assets/telephone.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading telephone audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.merciMsg = new Audio.Sound();
    //   globalAny.merciMsg.loadAsync(require("./assets/merci.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading telephone audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.repeterMsg = new Audio.Sound();
    //   globalAny.repeterMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.repeterMsg.loadAsync(require("./assets/repeter.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading telephone audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.besoinNomMsg = new Audio.Sound();
    //   globalAny.besoinNomMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.besoinNomMsg.loadAsync(require("./assets/besoinnom.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.besoinTelMsg = new Audio.Sound();
    //   globalAny.besoinTelMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.besoinTelMsg.loadAsync(require("./assets/besointel.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.daccordMsg = new Audio.Sound();
    //   globalAny.daccordMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.daccordMsg.loadAsync(require("./assets/daccord.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.departementMsg = new Audio.Sound();
    //   globalAny.departementMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.departementMsg.loadAsync(require("./assets/departement.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.jecouteMsg = new Audio.Sound();
    //   globalAny.jecouteMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.jecouteMsg.loadAsync(require("./assets/jecoute.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.infoGoodMsg = new Audio.Sound();
    //   globalAny.infoGoodMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.infoGoodMsg.loadAsync(require("./assets/infoGood.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });

    //   globalAny.modifyMsg = new Audio.Sound();
    //   globalAny.modifyMsg.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    //   globalAny.modifyMsg.loadAsync(require("./assets/modify.mp3")).then((result: any) => {
    //   }).catch((err: any) => {
    //     debugMsg("Failed Loading besoinNomMsg audio file");
    //     debugMsg(err.message, err.code);
    //   });
    // })();

    Camera.requestPermissionsAsync().then(cameraPermissions => {
      setPermissionsGranted(cameraPermissions.status === 'granted');
      setLoadingCamera(false);
    }).catch((err: any) => {
      debugMsg("Failed Requesting Camera Permissions");
      debugMsg(err.message, err.code);
    });

    // BarCodeScanner.requestPermissionsAsync().then(barCodePermission => {
    //   setBarCodePermissionsGranted(barCodePermission.status === 'granted');
    //   setLoadingBarCode(false);
    // }).catch((err: any) => {
    //   debugMsg("Failed Requesting BarCodeScanner Permissions");
    //   debugMsg(err.message, err.code);
    // });

    Voice.onSpeechStart = handleSpeechStart;
    Voice.onSpeechEnd = handleSpeechEnd;
    Voice.onSpeechResults = handleSpeechResults;
    Voice.onSpeechError = handleSpeechError;

    globalAny.detectedFaces = new Map();
    globalAny.detectedSomeone = false;
    globalAny.lastSpoke = null;
    globalAny.atStage = 0;
    globalAny.followUpStage = 0;
    globalAny.aiActive = true;
    //setAtStage(0);
    const ti = setInterval(() => {
      if(globalAny.aiActive) {
        var now = moment();
        for(const k of [...globalAny.detectedFaces.keys()]){
          var val = globalAny.detectedFaces.get(k);
          if (now.diff(val.firstSeen) >= TIMER_VISITOR_DECTION_RATE) {
            if (val.lastSeen === null || now.diff(val.lastSeen) > TIMER_VISITOR_DECTION_RATE) { // remove, face is likely gone
              globalAny.detectedFaces.delete(k);
            } else if (now.diff(val.lastSeen) < TIMER_VISITOR_DECTION_RATE && !globalAny.detectedSomeone) { //somone is standing in front
              globalAny.detectedSomeone = true;
              setSomeonesThere(true);
              debugMsg("Detected Someone :)");
              detectedSomeoneNew();
            }
          }
        }

        if (globalAny.detectedFaces.size === 0 && globalAny.detectedSomeone) {
          debugMsg("That Someone is gone :(");
          globalAny.detectedSomeone = false;
          setSomeonesThere(false);
          stopListening();
        }

        if(globalAny.listeningForAnswer && globalAny.lastSpoke !== null && now.diff(globalAny.lastSpoke ) >= TIMER_VISITOR_DECTION_RATE) {
          processVoiceRecognition();
        }
      }
    }, 1000);

    return () => {
      clearInterval(ti);
      Voice.destroy().then(Voice.removeAllListeners);
      Tts.removeEventListener('tts-start', onTTSStart);
      Tts.removeEventListener('tts-finish', onTTSFinish);
      Tts.removeEventListener('tts-cancel', onTTSCancel);
    }
  }, []);

  const onTTSStart = (event:any) => {
    console.log("start", event);
  }
  const onTTSFinish = (event:any) => {
    console.log("finish", event);
    if(globalAny.aiActive) {
      debugMsg("Done playing question.");
      Audio.setAudioModeAsync({ allowsRecordingIOS: true }).then((result: any) => {
        debugMsg("Audio recording set.");
        startListening(); 
      }).catch((err: any) => {
        debugMsg("Failed Setting audio to recording");
        debugMsg(err.message, err.code);
      });
    }
  }
  const onTTSCancel = (event:any) => {
    console.log("cancel", event);
  }

  // const onPlaybackStatusUpdate = (status:any) => {
  //   //debugMsg("[handleSpeechStart] " + JSON.stringify(status));
  //   if(status.didJustFinish) {
  //     debugMsg("Done playing question.");
  //     Audio.setAudioModeAsync({ allowsRecordingIOS: true }).then((result: any) => {
  //       debugMsg("Audio recording set.");
  //       startListening(); 
  //     }).catch((err: any) => {
  //       debugMsg("Failed Setting audio to recording");
  //       debugMsg(err.message, err.code);
  //     });
  //   }
  // }
  const handleSpeechStart = () => {
    //debugMsg("[handleSpeechStart] ");
  }
  const handleSpeechEnd = () => {
    //debugMsg("[handleSpeechEnd] ");
  }
  const handleSpeechResults = (event:any) => {    
    if (event.value && event.value[0] && globalAny.listeningForAnswer) {
      debugMsg("[handleSpeechResults]", event)
      globalAny.voiceRecognitionResult = event.value[0];
      globalAny.lastSpoke = moment();//setLastSpoke(moment());
    }
  }

  const handleSpeechError = (e:any) => {
    debugMsg("[handleSpeechError] ");
    debugMsg(JSON.stringify(e));
    // setListeningForAnswer(false);
    // globalAny.listeningForAnswer = false;
  }

  const stopListening = () => {
    globalAny.listeningForAnswer = false;
    setListeningForAnswer(false);
    globalAny.lastSpoke =null;//setLastSpoke(null);

    Voice.stop().then((result: any) => {
      debugMsg("Voice recognition stopped.");
      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).then((result2: any) => {
        debugMsg("Audio not recording set.");
      }).catch((err: any) => {
        debugMsg("Failed Setting audio to not recording");
        debugMsg(err.message, err.code);
      });
    }).catch((err: any) => {
      debugMsg("Failed stopping voice recognition");
      debugMsg(err.message, err.code);
    });
  }

  const startListening = () => {
      Voice.start('fr-CA').then( (result: any) => {
        debugMsg("Voice recognition started");
        setListeningForAnswer(true);
        globalAny.listeningForAnswer = true;
      }).catch((err: any) => {
        debugMsg("Failed starting voice recognition");
        debugMsg(err.message, err.code);
      });
  }

  const stopEverythingAndPause = () => {
    globalAny.aiActive = false;
    globalAny.detectedFaces = new Map();
    globalAny.detectedSomeone = false;
    globalAny.lastSpoke = null;
    globalAny.atStage = 0;
    globalAny.followUpStage = 0;
    setSomeonesThere(false);
    stopListening();
    setVisitingFloor(null);
    setNewRequestOptions([]);
    setNewRequestOptionsText([]);
    setTimeout(() => { globalAny.aiActive = true }, 5000);
  }

  const insertUpdateSimplePropertyOption = (property:any, value:any, label:string) => {
    let newRequestOptionsCopy = [...newRequestOptions];
    const selectedPropertyValuendex = newRequestOptionsCopy.findIndex(o => o._id === property._id);

    if(selectedPropertyValuendex === -1) { //new
      setNewRequestOptions([...newRequestOptionsCopy, {_id:property._id, label:property.text, value:value}]);
    } else { //update
      let copyOption = {...newRequestOptionsCopy[selectedPropertyValuendex]};
      copyOption.value = value;
      setNewRequestOptions([
        ...newRequestOptionsCopy.slice(0, selectedPropertyValuendex),
        copyOption,
        ...newRequestOptionsCopy.slice(selectedPropertyValuendex + 1)
      ]);
    }

    let newRequestOptionsCopyText = [...newRequestOptionsText];
    const selectedPropertyTextValuendex = newRequestOptionsCopyText.findIndex(o => o._id === property._id);
    if(selectedPropertyTextValuendex === -1) { //new
      setNewRequestOptionsText([...newRequestOptionsCopyText, {_id:property._id, label:property.text, value:label, valueId:value}]);
    } else { //update
      let copyOption = {...newRequestOptionsCopyText[selectedPropertyTextValuendex]};
      copyOption.value = label;
      copyOption.valueId = value;
      setNewRequestOptionsText([
        ...newRequestOptionsCopyText.slice(0, selectedPropertyTextValuendex),
        copyOption,
        ...newRequestOptionsCopyText.slice(selectedPropertyTextValuendex + 1)
      ]);
    }
  }

  const getPropertyOptionLabelValue = (property:any) => {
    const selectedPropertyValuendex = newRequestOptions.findIndex(o => o._id === property._id);
    if(selectedPropertyValuendex === -1){ //new
      return '';
    } else {
      return newRequestOptions[selectedPropertyValuendex].label;
    }
  }

  const registerVisitor = () => {

    // let fromReq = null;

    // if(selectedBedFromRequest) {
    //   fromReq = {...selectedBedFromRequest};
    //   if(selectedFromRequest.type === "section"){
    //     fromReq.label = selectedFromRequest.floorLabel + " - "+ selectedFromRequest.label +" - " + fromReq.label;
    //     fromReq = {...fromReq, section:selectedFromRequest};
    //   } else {
    //     fromReq.label = selectedFromRequest.label + " - " + fromReq.label;
    //     fromReq = {...fromReq, floor:selectedFromRequest};
    //   }
    // } else {
    //   fromReq = selectedFromRequest;
    // }

    axios.put("/projetkhiron/visitor/requests", {
      requestFor: visitorDestination,
      requestedOn: new Date(),
      options: newRequestOptionsText,
    })
    .then((response) => {
      //console.log(response);
      if (response.status === 200) {
        // setAlertMessage("Envoyer");
        // setAlertType("success");
        // setOpenAlert(true);
      }
    }).catch(error => {
      // setAlertMessage(JSON.stringify(error));
      // setAlertType("error");
      // setOpenAlert(true);
      // console.log("ERROR");
      // console.log(error);
    });
  }

  const HERE_FOR_A_VISIT = 1;
  const WHAT_FLOOR = 2;
  const WHAT_ROOM = 3;

  const GET_ALL_PROPERTIES = 4;
    const YOUR_NAME = 3;
    const YOUR_PHONE_NUMBER = 4;
  
  const IS_INFO_GOOD= 5;
  const MODIFY_INFO = 6;

  const CAN_YOU_REPEAT = 100;
  const IM_LISTENING = 101;
  const NEED_NAME = 102;
  const NEED_NUMBER = 103;

  const askQuestionToUser = (question:string, stage:number=0) => {
    if(stage > 0){
      globalAny.atStage = stage;
    }
    Tts.speak(question);
  }
  const isAllInfoAcquired = () => {
    return false;
  }
  const setAndSpeakNextPropertyToAquire = () {
    globalAny.atStage = GET_ALL_PROPERTIES;

  }

  const processVoiceRecognition = () => {
    debugMsg("[processVoiceRecognition] " + globalAny.voiceRecognitionResult);

    stopListening();

    debugMsg("NLP processing starting");
    globalAny.nlp.process('fr', globalAny.voiceRecognitionResult).then((response:any) => {
      globalAny.voiceRecognitionResult = null;
      debugMsg("NLP processing done");
      var positiveIntent = null;
      var negativeIntent = null;
      var unsureIntent = null;
      var nameIntent = null;
      var entity = null;
      var maxIntent = null;

      switch (globalAny.atStage) {
        case HERE_FOR_A_VISIT: //"Bonjour, vous êtes ici pour une visite?"
          debugMsg("Looking for confirmation.positive intent");
          positiveIntent = response.classifications.find((element:any) => element.label === "confirmation.positive");
          debugMsg("Found confirmation.positive intent");
          if (positiveIntent && positiveIntent.value >= 0.9) { //answered yes
            globalAny.atStage = WHAT_FLOOR;
            askQuestionToUser('Sur quel étage allez-vous?');
            //moveToStage(WHAT_FLOOR);
          } else {
            negativeIntent = response.classifications.find((element:any) => element.label === "confirmation.negative");
            if(negativeIntent && negativeIntent.value >= 0.9) {//answered no
                //end dialogue
                stopEverythingAndPause();
            } else { //did not figure out answer, ask to repete
              //askQuestion(CAN_YOU_REPEAT);
              askQuestionToUser('Pouvez-vous répéter?');
            }
          }
          break;

        case WHAT_FLOOR: //Sur quel étage aller vous?
          entity = response.entities.find((element:any) => element.entity === "ordinal");
          if (entity && entity.accuracy >= 0.9 && entity.resolution.subtype === "integer") {
            setVisitingFloor(entity.resolution.strValue);

            if(isAllInfoAcquired()){
              askQuestionToUser("Est-ce que l'information est exacte?",IS_INFO_GOOD);
            } else {
              askQuestionToUser('Quel Chambre?', WHAT_ROOM);
            }
          } else {
            unsureIntent = response.classifications.find((element:any) => element.label === "confirmation.unsure");
            if(unsureIntent && unsureIntent.value > 0.9) {
              globalAny.departementMsg.replayAsync().then((result: any) => { }).catch((err: any) => {
                debugMsg("Failed replaying departementMsg audio file");
                debugMsg(err.message, err.code);
              });
            } else {
              askQuestionToUser('Pouvez-vous répéter?');
            }
          }
          break;

        case WHAT_ROOM: //Sur quel étage aller vous?
          entity = response.entities.find((element:any) => element.entity === "ordinal");
          if (entity && entity.accuracy >= 0.9 && entity.resolution.subtype === "integer") {
            setVisitingRoom(entity.resolution.strValue);

            if(isAllInfoAcquired()){
              askQuestionToUser("Est-ce que l'information est exacte?",IS_INFO_GOOD);
            } else {
              setAndSpeakNextPropertyToAquire();
            }
          } else {
            unsureIntent = response.classifications.find((element:any) => element.label === "confirmation.unsure");
            if(unsureIntent && unsureIntent.value > 0.9) {
              globalAny.departementMsg.replayAsync().then((result: any) => { }).catch((err: any) => {
                debugMsg("Failed replaying departementMsg audio file");
                debugMsg(err.message, err.code);
              });
            } else {
              //askQuestion(CAN_YOU_REPEAT);
              askQuestionToUser('Pouvez-vous répéter?');
            }
          }
          break;

        case GET_ALL_PROPERTIES:
          //process prop set prop answer


          if(isAllInfoAcquired()){
            askQuestionToUser("Est-ce que l'information est exacte?",IS_INFO_GOOD);
          } else {
            setAndSpeakNextPropertyToAquire();
          }
          break;

        // case YOUR_NAME: //Puis-je avoir votre nom?
        //   positiveIntent = response.classifications.find((element:any) => element.label === "confirmation.positive");
        //   negativeIntent = response.classifications.find((element:any) => element.label === "confirmation.negative");
        //   unsureIntent = response.classifications.find((element:any) => element.label === "confirmation.unsure");
        //   //var nameIntent = response.classifications.find((element:any) => element.label === "identify.name");

        //   if(negativeIntent && negativeIntent.value >= 0.9 || unsureIntent && unsureIntent.value >= 0.9) {
        //     askQuestion(NEED_NAME);
        //   } else if(positiveIntent && positiveIntent.value >= 0.9) {
        //     askQuestion(IM_LISTENING);
        //   } else {
        //     setVisitorName(response.utterance);
        //     if(globalAny.followUpStage && globalAny.followUpStage > 0){
        //       moveToStage(globalAny.followUpStage);
        //       globalAny.followUpStage = 0;
        //     } else {
        //       moveToStage(YOUR_PHONE_NUMBER);
        //     }
        //   }
          
        //   break;
        
        // case YOUR_PHONE_NUMBER: //Puis-je un numéro de téléphone?
        //   entity = response.entities.find((element:any) => element.entity === "phonenumber");
        //   if (entity && entity.accuracy >= 0.9) {
        //     setVisitorPhone(entity.resolution.value);
        //     //confirm information
        //     if(globalAny.followUpStage && globalAny.followUpStage > 0){
        //       moveToStage(globalAny.followUpStage);
        //       globalAny.followUpStage = 0;
        //     } else {
        //       moveToStage(IS_INFO_GOOD);
        //     }
        //   } else {
        //     positiveIntent = response.classifications.find((element:any) => element.label === "confirmation.positive");
        //     negativeIntent = response.classifications.find((element:any) => element.label === "confirmation.negative");
        //     unsureIntent = response.classifications.find((element:any) => element.label === "confirmation.unsure");

        //     if(positiveIntent && positiveIntent.value >= 0.9) {
        //       askQuestion(IM_LISTENING);
        //     } else if(negativeIntent && negativeIntent.value >= 0.9 || unsureIntent && unsureIntent.value >= 0.9){
        //       askQuestion(NEED_NUMBER);
        //     } else {
        //       askQuestion(CAN_YOU_REPEAT);
        //     }
        //   }
        //   break;
        
        case IS_INFO_GOOD: //Est-ce que votre information à l'écran est exact?
            positiveIntent = response.classifications.find((element:any) => element.label === "confirmation.positive");
            if (positiveIntent && positiveIntent.value >= 0.9) { //answered yes
              
              stopEverythingAndPause();

              askQuestionToUser('Merci, vous êtes enregistré.');
  
              //TODO enregistrement

            } else {
              negativeIntent = response.classifications.find((element:any) => element.label === "confirmation.negative");
              unsureIntent = response.classifications.find((element:any) => element.label === "confirmation.unsure");
              if(negativeIntent && negativeIntent.value >= 0.9 || unsureIntent && unsureIntent.value >= 0.9){
                askQuestionToUser('Quel élément voulez-vous modifier?',MODIFY_INFO);
              } else {
                //askQuestion(CAN_YOU_REPEAT);
                askQuestionToUser('Pouvez-vous répéter?');
              }
            }
            break;
        
        case MODIFY_INFO: //Quel information voulez-vous modifier?
          debugMsg(JSON.stringify(response));
          // maxIntent = response.classifications.reduce((max:any, element:any) => max.value > element.value ? max : element);
          // if(maxIntent.label === "change.name"){
          //   globalAny.followUpStage = IS_INFO_GOOD;
          //   moveToStage(YOUR_NAME);
          // } else if(maxIntent.label === "change.floor") {
          //   globalAny.followUpStage = IS_INFO_GOOD;
          //   moveToStage(WHAT_FLOOR);
          // } else if(maxIntent.label === "change.phone") {
          //   globalAny.followUpStage = IS_INFO_GOOD;
          //   moveToStage(YOUR_PHONE_NUMBER);
          // } else {
          //   var changeNameIntent = response.classifications.find((element:any) => element.label === "change.name");
          //   var changeFloorIntent = response.classifications.find((element:any) => element.label === "change.floor");
          //   var changePhoneIntent = response.classifications.find((element:any) => element.label === "change.phone");
          //   //pick highest one
            
          //   askQuestionToUser('Pouvez-vous répéter?');
          // }


          break;
        default:
          debugMsg(" At unsupported stage");
          break;
      }
    }).catch((err: any) => {
      debugMsg("Failed processing nlp");
      debugMsg(err.message, err.code);
    });
  }

  const moveToStage = (stage:number) => {
    debugMsg("moving to stage" + stage);
    globalAny.atStage = stage;
    askQuestion(stage);
  }

   const askQuestion = async (stage:number) => {
    // new Promise((resolve, reject) => {
    debugMsg("askQuestion atStage:" + stage);
    switch(stage){
      case HERE_FOR_A_VISIT:
        Tts.speak('Bonjour, vous venez pour une visite?');
        break;

      case WHAT_FLOOR:
        Tts.speak('Sur quel étage allez-vous?');
        break;

      case YOUR_NAME:
        Tts.speak('Puis-je avoir votre nom?');
        break;

      case YOUR_PHONE_NUMBER:
        Tts.speak('Puis-je avoir un numéro de téléphone?');
        break;

      case IS_INFO_GOOD:
        Tts.speak("Est-ce que l'information est exacte?");
        break;

      case MODIFY_INFO:
        Tts.speak('Quel élément voulez-vous modifier?');
        break;

      case CAN_YOU_REPEAT:
        Tts.speak('Pouvez-vous répéter?');
        break;

      case IM_LISTENING:
        Tts.speak("J'écoute!");
        break;

      case NEED_NAME:
        Tts.speak("J'ai besoin d'un nom,");
        break;

      case NEED_NUMBER:
        Tts.speak("J'ai besoin d'un nom,");
        break;

      default:
        debugMsg("Unknown question stage");
        break;
    }

   
  }
  const detectedSomeoneNew = () => {
    moveToStage(HERE_FOR_A_VISIT);
  }

  const onFacesDetected = ({ faces }) => {
    faces.map((face:any) => {
      var val = globalAny.detectedFaces.get(face.faceID);
      if (val) {
        val = { firstSeen: val.firstSeen, lastSeen: moment() };
      } else {
        val = { firstSeen: moment(), lastSeen: null };
      }
      globalAny.detectedFaces.set(face.faceID, val);
    })
    setFoundFaces(faces);
  }

  // const onBarCodeScanned = ({ type, data }) => {
  //   //setScanned(true);
  //   debugMsg(`Bar code with type ${type} and data ${data} has been scanned!`);
  // };

  const handleMountError = ({ message }) => debugMsg(message);

  // const renderFace = ({ bounds, faceID, rollAngle, yawAngle }) => {
  //   return (
  //     <View
  //       key={faceID}
  //       transform={[
  //         { perspective: 600 },
  //         { rotateZ: `${rollAngle.toFixed(0)}deg` },
  //         { rotateY: `${yawAngle.toFixed(0)}deg` },
  //       ]}
  //       style={[
  //         styles.face,
  //         {
  //           ...bounds.size,
  //           left: bounds.origin.x,
  //           top: bounds.origin.y,
  //         },
  //       ]}>
  //     </View>
  //   );
  // }

  // const renderFaces = () =>
  //   <View style={styles.facesContainer} pointerEvents="none">
  //     {foundFaces.map(renderFace)}
  //   </View>

  const renderCamera = () => {
    const {height, width} = Dimensions.get('window');

    var display = null;
    if(someonesThere) {
      var extraSettings = null;
      if(visitorSettings){
        extraSettings = visitorSettings.extra.map(property => {
        if(property.required)
          return <Text style={{ color: 'white', fontWeight:'bold', paddingTop:10 }}>*{property.text}: {getPropertyOptionLabelValue(property)}</Text>
        else
          return <Text style={{ color: 'white', paddingTop:10 }}>{property.text}: {getPropertyOptionLabelValue(property)}</Text>
        })
      }
      display = <>
        <View style={{maxWidth:width, width:width, height:height/2, maxHeight:height/2}}>
        <Image source={require("./assets/ai.gif")} style={{maxWidth:width, width:width, height:height/2-60, maxHeight:height/2-60}}/>
        <Spinner animating={listeningForAnswer}/>
      </View>
      <View style={{maxWidth:width, width:width, height:height/2, maxHeight:height/2}}>
        <Text style={{ color: 'white',fontWeight:'bold', paddingTop:10}}>*Étage : {visitingFloor}</Text>
        <Text style={{ color: 'white',fontWeight:'bold', paddingTop:10}}>*Chambre : </Text>
        {extraSettings}
      </View>
      </>;
    } else {
      display = <Text style={{ color: 'white',padding:10 }}>Service d'enregistrement automatisé</Text>;
    }

      return (
        <>
        <View style={{ flex:1, flexDirection: 'column', justifyContent:'center', alignItems:'center' }}>
        {display}
        </View>
        <Camera
            ref={camera}
            style={styles.camera}
            onMountError={handleMountError}
            onFacesDetected={onFacesDetected}
            type={Camera.Constants.Type.front}
            faceDetectorSettings={{
              mode: FaceDetector.Constants.Mode.fast,
              detectLandmarks: FaceDetector.Constants.Landmarks.none,
              runClassifications: FaceDetector.Constants.Classifications.none,
              minDetectionInterval: 250,
              tracking: true,
            }}
          ></Camera>
          </>
      );
    }

    const renderNoCameraPermissions = () =>
    <View style={styles.noPermissions}>
      <Text style={{ color: 'white' }}>
        Camera permissions not granted - application will not work.
    </Text>
    </View>

  const renderLoading = () =>
    <View style={styles.noPermissions}>
      <Text style={{ color: 'white' }}>
        Chargement de l'IA
      </Text>
      {/* <Text style={{ color: 'white' }}>Loading NLP : {loadingNlp?"True":"False"}</Text>
      <Text style={{ color: 'white' }}>Loading Camera : {loadingCamera?"True":"False"}</Text>
      <Text style={{ color: 'white' }}>Loading Audio : {loadingAudio?"True":"False"}</Text> */}
      <Spinner size="large" />
    </View>

  var cameraScreenContent = null;
  if(loadingNlp || loadingCamera || loadingAudio || loadingTTS || loadingSettings){
    cameraScreenContent = renderLoading();
  } else if (!permissionsGranted) {
    cameraScreenContent = renderNoCameraPermissions();
  } else {
    cameraScreenContent = renderCamera(); 
  }
    
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {cameraScreenContent}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
  },

  noPermissions: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  gallery: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toggleButton: {
    flex: 0.25,
    height: 40,
    marginHorizontal: 2,
    marginBottom: 10,
    marginTop: 20,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoFocusLabel: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  bottomButton: {
    flex: 0.3,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPhotosDot: {
    position: 'absolute',
    top: 0,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4630EB'
  },
  options: {
    position: 'absolute',
    bottom: 80,
    left: 30,
    width: 200,
    height: 160,
    backgroundColor: '#000000BA',
    borderRadius: 4,
    padding: 10,
  },
  detectors: {
    flex: 0.5,
    justifyContent: 'space-around',
    alignItems: 'center',
    flexDirection: 'row',
  },
  facesContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
  },
  face: {
    padding: 10,
    borderWidth: 2,
    borderRadius: 2,
    position: 'absolute',
    borderColor: '#FFD700',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  faceText: {
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 10,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
  },
});

export default withAuthenticator(App, "cognito");
//export default App;
