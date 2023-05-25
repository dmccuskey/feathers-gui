const port = 9092 // Easy to change the port here

module.exports = {
  devServer: {
    port, // This will take care of desktop machine
    host: `0.0.0.0`, // This will take care of mobile device
    headers: {
      // added CORS for localhost or IP access
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept',
    },
  },
}
