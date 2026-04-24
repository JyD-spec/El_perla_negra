try {
  const plugin = require('../node_modules/@stripe/stripe-react-native/app.plugin.js');
  console.log('Plugin loaded successfully');
  console.log('Type of plugin:', typeof plugin);
} catch (err) {
  console.error('Failed to load plugin:', err);
}
