import React, {useState} from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Modal, Platform, ImageBackground} from 'react-native';
import { Text, View } from '../components/Themed';
import {useTheme}  from '../components/ThemeContext'
import { Input, Button } from 'react-native-elements';
import { Spinner } from 'native-base'

export default function NewPasswordScreen(props:any) {
    const theme = useTheme();

    const [pwd, setPwd] = useState('');
    const [confirmedPwd, setConfirmedPwd] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isProcessingLogin, setIsProcessingLogin] = useState(false);
    const handleLogin = () => {
        setErrorMessage('');
        setIsProcessingLogin(true);
        if(props.onNewPassword) {
            props.onNewPassword(props.user, props.email, pwd)
            .then(() => {
                setIsProcessingLogin(false);
            }).catch(error => {
                console.log("[NewPasswordScreen] Error login in : " + error.message);
                setErrorMessage(error.message);
                setIsProcessingLogin(false);
            })
        }
    }

    return (<SafeAreaProvider>
    <View style={{
    flex: 1, 
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor:theme.SystemBackgroundColor,
    }} >
    <Modal
    animationType="slide"
    transparent={true}
    visible={true}
    onRequestClose={() => {
        //console.log("Modal has been closed.");
    }}
    >
    <View style={{
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22,
        backgroundColor:theme.SystemBackgroundColor,
        width:'100%'
        }}>
            <ImageBackground source={require('../assets/images/hopital_splash.png')} style={{flex: 1, width:'100%', resizeMode: 'cover', justifyContent: "center"}}>
        <View style={{
            justifyContent: 'center',
            alignItems: 'center',
            width: '90%',
            margin: 20,
            borderRadius: 20,
            padding: 10,
            shadowColor: "#000",
            shadowOffset: {
            width: 0,
            height: 2
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            backgroundColor:theme.SecondarySystemBackgroundColor
        }}>
        <View style={{
            ...(Platform.OS !== 'android' && {
                zIndex: 20
            }), padding: 10, width:'100%', justifyContent: 'center', alignItems: 'center',
            backgroundColor:theme.SecondarySystemBackgroundColor
            }}>
            {isProcessingLogin?<View style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center'}}><Spinner /></View>:null}
            <Text style={{fontSize:25}}>Projet Khiron</Text>
            <Text >Vous devez changer votre mot de passe</Text>
            <Input
                placeholder="Nouveau mot de passe"
                secureTextEntry={true} 
                leftIcon={{ type: 'font-awesome', name: 'lock', color:theme.LabelColor}}
                value={pwd}
                autoCapitalize='none'
                autoCompleteType='off'
                autoCorrect={false}
                keyboardType='default'
                onChangeText={value => setPwd(value)}
                inputStyle={{color:theme.LabelColor}}
                />
            <Input
                placeholder="Confirmer nouveau mot de passe"
                secureTextEntry={true} 
                leftIcon={{ type: 'font-awesome', name: 'lock', color:theme.LabelColor}}
                value={confirmedPwd}
                autoCapitalize='none'
                autoCompleteType='off'
                autoCorrect={false}
                keyboardType='default'
                onChangeText={value => setConfirmedPwd(value)}
                inputStyle={{color:theme.LabelColor}}
                />
            { pwd.trim().length !== 0 || confirmedPwd.trim().length !== 0 && pwd !== confirmedPwd?<Text style={{color:'red'}}>{errorMessage}</Text>:null}
            <Text style={{color:'red'}}>{errorMessage}</Text>
            <Button
                title="Connexion"
                style={{width:150}}
                disabled={isProcessingLogin || pwd.trim().length === 0 || confirmedPwd.trim().length === 0 || pwd !== confirmedPwd}
                onPress={handleLogin}
            />
        </View>
        </View>
        </ImageBackground>
    </View>
    </Modal>
    </View>
    </SafeAreaProvider>);
}