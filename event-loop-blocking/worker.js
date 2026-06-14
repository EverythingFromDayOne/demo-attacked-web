const { workerData, parentPort } = require('worker_threads');

if (workerData.type === 'compute') {
  let result = 0;
  const n = workerData.n;
  for (let i = 0; i < n; i++) {
    result += Math.sqrt(i * Math.PI) * Math.log(i + 1);
  }
  parentPort.postMessage({ result, iterations: n });
}

if (workerData.type === 'regex') {
  const re = new RegExp(workerData.pattern);
  const match = re.test(workerData.text);
  parentPort.postMessage({ match });
}
