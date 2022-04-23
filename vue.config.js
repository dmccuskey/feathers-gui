const port = 8081 // Easy to change the port here

module.exports = {
  baseUrl: `http://localhost:${port}/`,
  devServer:
    {
      port, // This will take care of desktop machine
      host: `0.0.0.0`, // This will take care of mobile device
    },
}
