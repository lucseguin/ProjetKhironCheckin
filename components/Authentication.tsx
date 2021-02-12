import React from 'react';
import { Auth }  from 'aws-amplify';
import LoginScreen from '../screens/LoginScreen';
import NewPasswordScreen from '../screens/NewPasswordScreen';
import EventCoordinator from '../components/EventCoordinator';
import AsyncStorage from '@react-native-community/async-storage';


export function logoutUser(authSystem:string) {
  if(authSystem === "cognito") {
    //return new Promise(function(resolve, reject) {
      Auth.signOut()
      .then(value => {
        EventCoordinator.signal('auth', {type:'signOut', data:null, message:'Sucessfully signed out through Cognito'});
        //resolve('Logged out');
      })
      .catch(error => {
        console.log("[CognitoAuthentication] Auth.signIn Error : " + error.message);
        //reject(error);
      });
    //});
  }
}

export function withAuthenticator(WrappedComponent:any, authSystem:string) {
    return class extends React.Component {
      state = {
        isSignedIn: false,
        userData :null,
        errorMessage:null
      };

      constructor(props:any) {
        super(props);
       
        AsyncStorage.getItem('@user-signed-in-to-app')
        .then(value => {
          if(value === 'true') {
            this.setState({isSignedIn: true});
          }
        }).catch(error => {
          console.log("error retreiving @user-signed-in-to-app " + error.message);
        });

        EventCoordinator.register('auth', ({ payload }) => {
          const { type } = payload;
          switch (type) {
            case 'signIn':
              this.setState({isSignedIn: true, errorMessage:null, userData:null});
              AsyncStorage.setItem('@user-signed-in-to-app', 'true');
              break;
            case 'newPassword':
              this.setState({userData: payload.data});
              break;
            case 'signOut':
              this.setState({isSignedIn: false});
              if(payload.errorMessage) {
                this.setState({errorMessage: payload.errorMessage});
              }
              AsyncStorage.removeItem('@user-signed-in-to-app');
              break;
          }
        });

      }
  
      componentDidMount() {
        // ... that takes care of the subscription...
        //DataSource.addChangeListener(this.handleChange);
      }
  
      componentWillUnmount() {
        //DataSource.removeChangeListener(this.handleChange);
      }
  
       onLogin = async (email:string, pwd:string) => {
          //console.log("[CognitoAuthentication] onLogin using authSystem:"+authSystem);
          if(authSystem === "cognito") {
            return new Promise(function(resolve, reject) {
                Auth.signIn(email, pwd)
                .then(user => {
                  if(user.challengeName === 'NEW_PASSWORD_REQUIRED'){
                    EventCoordinator.signal('auth', {type:'newPassword', data:{user:user, email:email}, message:'Need new password'});
                  } else {
                    EventCoordinator.signal('auth', {type:'signIn', data:user, message:'Successfull Cognito user sign in'});
                  }
                  resolve(user);
                })
                .catch(error => {
                  console.log("[CognitoAuthentication] Auth.signIn Error : " + error.message);
                  reject(error);
                });
            });
          } else {
            throw Error("Unsupported authentication system.");
          }
      }
  
      onNewPassword =  (user:any, email:string, pwd:string) => {
        //console.log("[CognitoAuthentication] onLogin using authSystem:"+authSystem);
        if(authSystem === "cognito") {
          return new Promise(function(resolve, reject) {
            Auth.completeNewPassword(
              user,               // the Cognito User Object
              pwd,       // the new password
              {
                email,
              }
            ).then(signedInUser => {
                EventCoordinator.signal('auth', {type:'signIn', data:signedInUser, message:'Successfull Cognito user sign in'});
                resolve(user);
              })
              .catch(error => {
                console.log("[CognitoAuthentication] Auth.signIn Error : " + error.message);
                reject(error);
              });
          });
        } else {
          throw Error("Unsupported authentication system.");
        }
    }
    render() {
      if(this.state.isSignedIn)
        return <WrappedComponent {...this.props} />
      else if (!this.state.isSignedIn && this.state.userData !== null)
        return <NewPasswordScreen user={this.state.userData.user} email={this.state.userData.email} onNewPassword={this.onNewPassword.bind(this)}/>
      else
        return <LoginScreen errorMessage={this.state.errorMessage} onLogin={this.onLogin.bind(this)}/>
      }
    };
}