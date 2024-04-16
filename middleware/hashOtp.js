const bcrypt = require('bcrypt');
const axios = require('axios');
const { getSecretKeyAndTimeStamp } = require('../globalfunction/getSecretKey');
// Function to hash the password using bcrypt
const  hashOtp= async (password) => {
    try {
      if (!password) {
        throw new Error('Empty password provided');
      }
      password = password.toString()
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      console.log(`password -> ${password}   hashPassword - > ${hashedPassword}`)
      console.log('hashed password:', hashedPassword);
      return hashedPassword;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Error hashing password');
    }
  };
  
  
  // Function to verify password using bcrypt
  const VerifyOtp = async (password, hashedPassword) => {
    try
    {
      console.log(`INSIDE VERIFY password -> ${password}   hashPassword - > ${hashedPassword}`)
      const passwordMatch = await bcrypt.compare(password, hashedPassword);
      console.log(passwordMatch)
      return passwordMatch;
    } catch (error)
    {
      console.log(`error -> ${error}`)
      throw new Error('Error verifying password');
    }
  };
  
  
  
  

// Function to make the first Aadhar API call
async function getAdhaarConsent(mobile) {
    const url = 'https://api.eko.in:25002/ekoicici/v2/external/getAdhaarConsent';
    const { secretKey, Timestamp } = getSecretKeyAndTimeStamp();
    // const headers = {
    //     'developer_key': '0d13fefbdd3d507c3a1485e6694d4197',
    //     'secret-key': 'uwX5Z4NOhHI0ylToIIzYXdH1+wa9Asyl9QJOMLNpjn0=',
    //     'secret-key-timestamp': '1708803783634'
    // };
      const headers = {
        'developer_key': '0d13fefbdd3d507c3a1485e6694d4197',
        'secret-key': secretKey,
        'secret-key-timestamp': Timestamp
    };
    const params = {
        source: 'NEWCONNECT',
        initiator_id:'9830299198',
        is_consent: 'Y',
        consent_text: mobile,
        user_code: '31739001',
        realsourceip: '12.12.12.12'
    };

    try {
        const response = await axios.get(url, { headers, params });
       
        return response.data;
        
    } catch (error) {
        console.error('Error making Aadhar consent API call:', error);
        throw error;
    }
}

// Function to make the second Aadhar API call
async function getAdhaarOTP(aadharNumber, accessKey, mobile) {
    console.log(aadharNumber)
    console.log(accessKey)
    console.log(mobile)

    const { secretKey, Timestamp } = getSecretKeyAndTimeStamp();
    const url = 'https://api.eko.in:25002/ekoicici/v2/external/getAdhaarOTP';
    const headers = {
        'developer_key': '0d13fefbdd3d507c3a1485e6694d4197',
        'secret-key': secretKey,
        'secret-key-timestamp': Timestamp
    };
    const params = {
        source: 'NEWCONNECT',
        initiator_id: '9830299198',
        aadhar: aadharNumber,
        is_consent: 'Y',
        access_key: accessKey,
        caseId: '000988776676',
        user_code: '31739001',
        realsourceip: '12.12.12.12'
    };

    try {
        const response = await axios.get(url, { headers, params });
         console.log("****************************************")
        console.log(response.data);
        return response.data;
        
    } catch (error) {
        console.error('Error making Aadhar OTP API call:', error);
        throw error;
    }
}

// Function to make the third Aadhar API call
async function getAdhaarFile(aadharNumber, otp, accessKey) {
    console.log("8888888888")
    console.log(aadharNumber);
    console.log(otp);
    console.log(accessKey);
    console.log("8888888888")

    const url = 'https://api.eko.in:25002/ekoicici/v1/external/getAdhaarFile';
    const { secretKey, Timestamp } = getSecretKeyAndTimeStamp();
    const headers = {
        'developer_key': '0d13fefbdd3d507c3a1485e6694d4197',
        'secret-key': secretKey,
        'secret-key-timestamp': Timestamp
    };
    const params = {
        initiator_id: '9830299198',
        otp: otp,
        is_consent: 'Y',
        share_code: '1238',
        access_key: accessKey,
        caseId: '000988776676',
        aadhar: aadharNumber,
        user_code: '31739001',
        realsourceip: '12.12.12.12'
    };

    try {
      const response = await axios.get(url, { headers, params });
      console.log(response.data);
        return response.data;
    } catch (error) {
        console.error('Error making Aadhar file API call:', error);
        throw error;
    }
}

// Example usage:
// async function main() {
//     try {
//         const consentResponse = await getAdhaarConsent();
//         console.log('Consent API Response:', consentResponse);

//         const otpResponse = await getAdhaarOTP('883576789098', '4620cbfb-c97f-43cd-bfd3-639e69761d28', '000988776676');
//         console.log('OTP API Response:', otpResponse);

//         const fileResponse = await getAdhaarFile('883576789098', '922695', '1238', '96b6969a-bd6f-462a-8dbc-b19e894a5dbd', '000988776676');
//         console.log('File API Response:', fileResponse);
//     } catch (error) {
//         console.error('Error:', error);
//     }
// }

// Call the main function
// main();



  module.exports = {VerifyOtp, hashOtp ,getAdhaarConsent,getAdhaarOTP,getAdhaarFile};
  