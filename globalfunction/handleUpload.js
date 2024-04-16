const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { getSecretKeyAndTimeStamp } = require('./getSecretKey');


const handleFileUpload = async (req, res, obj) => {

  const { secretKey, Timestamp } = getSecretKeyAndTimeStamp();
  let { device_number, model_name, office_address, user_code,residential_address } = obj

  const off = JSON.parse(office_address);
  console.log(off);
  const formattedOfficeAddress = {
    "line": off.line,
    "city": off.area,
    "state": off.state,
    "pincode": off.pincode
};
// return formattedOfficeAddress

let data = new FormData();
data.append('form-data', `service_code=43&initiator_id=9830299198&user_code=${user_code}&devicenumber=${device_number}&modelname=${model_name}&office_address={"line":"${formattedOfficeAddress.line}","city":"${formattedOfficeAddress.city}","state":"${formattedOfficeAddress.state}","pincode":"${formattedOfficeAddress.pincode}"}&address_as_per_proof={"line":"${formattedOfficeAddress.line}","city":"${formattedOfficeAddress.city}","state":"${formattedOfficeAddress.state}","pincode":"${formattedOfficeAddress.pincode}"}`);
// data.append('pan_card', fs.createReadStream('D:/Images/header.jpg'));
// data.append('aadhar_front', fs.createReadStream('D:/Images/header.jpg'));
//   data.append('aadhar_back', fs.createReadStream('D:/Images/header.jpg'));

  data.append('pan_card', fs.createReadStream(req.files['pan_front'][0].path));
  data.append('aadhar_front', fs.createReadStream(req.files['aadhar_front'][0].path));
  data.append('aadhar_back', fs.createReadStream(req.files['aadhar_back'][0].path));
let config = {
  method: 'put',
  maxBodyLength: Infinity,
  url: 'https://api.eko.in:25002/ekoicici/v1/user/service/activate',
  headers: { 
    'Cache-Control': 'no-cache', 
    'developer_key': '0d13fefbdd3d507c3a1485e6694d4197', 
    // 'secret-key': 'mMg4oz1WSE0zTb3ehosawIbAjWpAuaOPwWlG16ynJ0k=',
    // 'secret-key-timestamp': '1667978242491', 
    'secret-key': secretKey, 
    'secret-key-timestamp': Timestamp, 
    ...data.getHeaders()
  },
  data : data
};
try {
  const response = await axios.request(config)
  // console.log(response.data);
  return {data: response.data, config:config};
} catch (error) {
  console.log(error);
}



}

module.exports = { handleFileUpload };
