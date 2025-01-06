import './App.css';
import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';

// 导入 ABI
import PointsExchangeABI from './abis/PointsExchange.json';
import RegularPointsABI from './abis/RegularPoints.json';
import UniversalPointsABI from './abis/UniversalPoints.json';

// 合约地址
const UNIVERSAL_POINTS_ADDRESS = "0xCaCe0E8567a2dfA74aA4694d1edD91d1F8C2093A";
const POINTS_EXCHANGE_ADDRESS = "0xBa1441620233b87dC32562E1f27C8F5cE5a098f7";

// 合约所有者私钥（保存在 .env 文件中）
const contractOwnerPrivateKey = process.env.REACT_APP_PRIVATE_KEY;

const deployRegularPoints = async (signer, name, symbol) => {
  // 合约部署函数
  const RegularPointsFactory = new ethers.ContractFactory(
    RegularPointsABI.abi,  // ABI
    RegularPointsABI.bytecode, // 合约字节码
    signer // 使用 signer 发送交易
  );

  try {
    const regularPoints = await RegularPointsFactory.deploy(name, symbol);
    console.log("RegularPoints contract deployed to:", regularPoints.address);
    return regularPoints.address;
  } catch (error) {
    console.error("Deployment failed:", error);
  }
};

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const [isWalletConnected, setIsWalletConnected] = useState(false); // 钱包连接状态

  const [regularPointsContract, setRegularPointsContract] = useState(null);
  const [universalPointsContract, setUniversalPointsContract] = useState(null);
  const [pointsExchangeContract, setPointsExchangeContract] = useState(null);

  const [amountToMint, setAmountToMint] = useState('');
  const [userPointsBalance, setUserPointsBalance] = useState('0');
  const [universalPointsBalance, setUniversalPointsBalance] = useState('0'); // 通用积分余额

  const [regularPointsAddress, setRegularPointsAddress] = useState(''); // 用户输入的合约地址

  const [exchangeRate, setExchangeRate] = useState('1');  // 默认兑换比例：1:1

  const [name, setName] = useState("");  // 用户输入的合约名称
  const [symbol, setSymbol] = useState("");  // 用户输入的合约符号

  // 连接到 MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const newProvider = new ethers.providers.Web3Provider(window.ethereum);
      const newSigner = newProvider.getSigner();
      const newAccount = await newSigner.getAddress();
      setAccount(newAccount);
      setProvider(newProvider);
      setSigner(newSigner);
      setIsWalletConnected(true);
    } else {
      alert('Please install MetaMask!');
    }
  };

  useEffect(() => {
    if (provider && signer) {
      const loadContracts = async () => {
        // 加载通用积分合约（UniversalPoints）
        const universalPoints = new ethers.Contract(UNIVERSAL_POINTS_ADDRESS, UniversalPointsABI.abi, signer);
        setUniversalPointsContract(universalPoints);

        // 加载积分兑换合约（PointsExchange）
        const pointsExchange = new ethers.Contract(POINTS_EXCHANGE_ADDRESS, PointsExchangeABI.abi, signer);
        setPointsExchangeContract(pointsExchange);

        // 获取通用积分余额
        const universalBalance = await universalPoints.balanceOf(account);
        setUniversalPointsBalance(ethers.utils.formatUnits(universalBalance, 18)); // 格式化并更新余额
      };
      loadContracts();
    }
  }, [provider, signer, account]);

  // 加载普通积分合约
  const loadRegularPointsContract = async (address) => {
    if (!ethers.utils.isAddress(address)) {
      alert('Invalid contract address');
      return;
    }
    try {
      const contract = new ethers.Contract(address, RegularPointsABI.abi, signer);
      const balance = await contract.balanceOf(account);
      setRegularPointsContract(contract);
      setUserPointsBalance(ethers.utils.formatUnits(balance, 18));
    } catch (error) {
      console.error("导入合约失败！", error);
      alert('导入合约失败！');
    }
  };

  // 处理用户输入合约地址
  const handleLoadContract = () => {
    if (regularPointsAddress) {
      loadRegularPointsContract(regularPointsAddress);
    } else {
      alert('请输入要导入的普通积分合约地址');
    }
  };

  // 查询当前账户的积分余额
  const getPointsBalance = async () => {
    if (universalPointsContract && regularPointsContract && account) {
      // 获取通用积分余额
      const universalBalance = await universalPointsContract.balanceOf(account);
      setUniversalPointsBalance(ethers.utils.formatUnits(universalBalance, 18));

      // 获取普通积分余额
      const regularBalance = await regularPointsContract.balanceOf(account);
      setUserPointsBalance(ethers.utils.formatUnits(regularBalance, 18));
    }
  };

  // 发行普通积分
  const issueRegularPoints = async () => {
    if (!amountToMint) {
      alert('Please enter the amount to mint');
      return;
    }
    const mintAmount = ethers.utils.parseUnits(amountToMint, 18);
    try {
      const tx = await regularPointsContract.mint(account, mintAmount);
      await tx.wait();
      alert(`成功发行 ${amountToMint} ${symbol}积分!`);
      getPointsBalance();
    } catch (err) {
      console.error(err);
      alert('发行失败！');
    }
  };

  const exchangePoints = async () => {
    // 检查普通积分合约地址是否存在，导入普通积分合约地址
    if (!regularPointsAddress) {
      loadRegularPointsContract(regularPointsContract.address);
    }
    try {
      // 检查并设置兑换比例
      const rate = await pointsExchangeContract.exchangeRates(regularPointsContract.address);  // 获取兑换比例
      if (rate.eq(0)) { 
        const newRate = prompt('请输入新的兑换比例 (例如：1 RPT = 2 UPT)');
        if (!newRate || isNaN(newRate)) {
          alert('请输入有效的兑换比例');
          return;
        }
        setExchangeRate(newRate);
        const txRate = await pointsExchangeContract.setExchangeRate(regularPointsContract.address, ethers.BigNumber.from(newRate));
        await txRate.wait();  // 等待交易确认
        alert(`兑换比例已设置为 1 RPT = ${newRate} UPT`);
      }

      // 获取要兑换的普通积分数量
      const amountToExchange = prompt('输入要兑换的普通积分数量:');
      if (!amountToExchange || isNaN(amountToExchange)) {
        alert('请输入有效的兑换数量');
        return;
      }
      // 将输入的数量转换为合适的单位（假设单位是18）
      const exchangeAmount = ethers.utils.parseUnits(amountToExchange, 18);

      try {
        const tx = await pointsExchangeContract.exchange(regularPointsContract.address, exchangeAmount);
        await tx.wait();
        alert(`成功兑换了 ${amountToExchange} RLP 成 UPT!`);
        getPointsBalance();
      } catch (err) {
        console.error(err);
        alert('兑换失败！');
      }
    } catch (err) {
      console.error(err);
      alert('兑换过程中发生错误！');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>基于区块链的积分通兑平台</h1>
        {isWalletConnected ? (
          <>
            <p>连接账号: {account}</p>
            <hr />
            <div>
              <h2>部署普通积分合约</h2>
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label htmlFor="symbol">Symbol:</label>
              <input
                type="text"
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
              <button onClick={() => deployRegularPoints(signer, name, symbol)}>Deploy Contract</button>
            </div>

            <hr />
            <div>
              <h2>导入普通积分合约</h2>
              <label htmlFor="regularPointsAddress">Regular Points Contract Address:</label>
              <input
                type="text"
                id="regularPointsAddress"
                value={regularPointsAddress}
                onChange={(e) => setRegularPointsAddress(e.target.value)}
              />
              <button onClick={handleLoadContract}>Load Contract</button>
            </div>

            <hr />
            <div>
              <h2>普通积分发行</h2>
              <label htmlFor="amountToMint">Amount to Mint:</label>
              <input
                type="number"
                id="amountToMint"
                value={amountToMint}
                onChange={(e) => setAmountToMint(e.target.value)}
              />
              <button onClick={issueRegularPoints}>Mint Regular Points</button>
            </div>

            <hr />
            <div>
              <h2>积分余额</h2>
              <button onClick={getPointsBalance}>Get Balance</button>
              <p>通用积分余额: {universalPointsBalance} UPT</p>
              <p>普通积分余额: {userPointsBalance} RLP</p>
            </div>

            <hr />
            <div>
              <h2>积分兑换（普通积分兑换成通用积分）</h2>
              <p>Exchange Rate: 1 RLP = {exchangeRate} UPT</p>
              <button onClick={exchangePoints}>Exchange Points</button>
            </div>
          </>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
    </div>
  );
}

export default App;
