const ethers = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');
const prompt = require('prompt-sync')({ sigint: true });
const colors = require('colors');

colors.enable();

const SWAP_COUNT = 10;
const LP_COUNT = 10;
const SEND_COUNT = 10;
const MAX_ATTEMPTS = 5;
const MINIMUM_OUT = 0n;
const DEFAULT_FEE = 500;
const TX_PAUSE_MS = 2000;
const RETRY_DELAY_MS = 60000;

const blockchainConfig = {
  networkName: "Pharos Testnet",
  chainId: 688688,
  rpcEndpoint: "https://testnet.dplabs-internal.com",
};

const SWAP_CONTRACT = "0x1A4DE519154Ae51200b0Ad7c90F7faC75547888a";
const LP_CONTRACT = "0xf8a1d4ff0f9b9af7ce58e1fc1833688f3bfd6115";
const USDC_POOL = "0x0373a059321219745aee4fad8a942cf088be3d0e";
const USDT_POOL = "0x70118b6eec45329e0534d849bc3e588bb6752527";
const WPHRS_TOKEN = "0x76aaada469d23216be5f7c596fa25f282ff9b364";
const USDC_TOKEN = "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37";
const USDT_TOKEN = "0xed59de2d7ad9c043442e381231ee3646fc3c2939";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0"
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const SWAP_ABI = [
  {
    "inputs": [
      { "internalType": "bytes[]", "name": "data", "type": "bytes[]" }
    ],
    "name": "multicall",
    "outputs": [
      { "internalType": "bytes[]", "name": "results", "type": "bytes[]" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
          { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
          { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" }
        ],
        "internalType": "struct ISwapRouter.ExactInputSingleParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "exactInputSingle",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "amountMinimum", "type": "uint256" },
      { "internalType": "address", "name": "recipient", "type": "address" }
    ],
    "name": "unwrapWETH9",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "refundETH",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

const LP_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "token0", "type": "address" },
          { "internalType": "address", "name": "token1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickLower", "type": "int24" },
          { "internalType": "int24", "name": "tickUpper", "type": "int24" },
          { "internalType": "uint256", "name": "amount0Desired", "type": "uint256" },
          { "internalType": "uint256", "name": "amount1Desired", "type": "uint256" },
          { "internalType": "uint256", "name": "amount0Min", "type": "uint256" },
          { "internalType": "uint256", "name": "amount1Min", "type": "uint256" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "internalType": "struct INonfungiblePositionManager.MintParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "mint",
    "outputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint128", "name": "liquidity", "type": "uint128" },
      { "internalType": "uint256", "name": "amount0", "type": "uint256" },
      { "internalType": "uint256", "name": "amount1", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];

const POOL_ABI = [
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "fee",
    "outputs": [{ "internalType": "uint24", "name": "", "type": "uint24" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "slot0",
    "outputs": [
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" },
      { "internalType": "int24", "name": "tick", "type": "int24" },
      { "internalType": "uint16", "name": "observationIndex", "type": "uint16" },
      { "internalType": "uint16", "name": "observationCardinality", "type": "uint16" },
      { "internalType": "uint16", "name": "observationCardinalityNext", "type": "uint16" },
      { "internalType": "uint8", "name": "feeProtocol", "type": "uint8" },
      { "internalType": "bool", "name": "unlocked", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const TOKEN_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const tokenInfo = [
  { address: USDC_TOKEN, pool: USDC_POOL, name: "USDC" },
  { address: USDT_TOKEN, pool: USDT_POOL, name: "USDT" },
];

const log = {
  success: (msg) => console.log(colors.green(`- ${msg}`)),
  error: (msg) => console.log(colors.red(`- Lỗi: ${msg}`)),
  banner: (msg) => console.log(colors.cyan.bold(`\n${msg}\n`)),
  action: (msg) => console.log(colors.yellow(`- ${msg}`)),
  info: (msg) => console.log(colors.white(`- ${msg}`)),
  warning: (msg) => console.log(colors.yellow(`- Cảnh báo: ${msg}`)),
};

async function retryTransaction(txFunction, maxRetries = MAX_ATTEMPTS, retryDelayMs = RETRY_DELAY_MS) {
  let attempt = 1;
  while (true) {
    try {
      return await txFunction();
    } catch (error) {
      if (error.error && error.error.code === -32008) {
        log.error(`Lỗi RPC -32008 (lần ${attempt}/${maxRetries}): ${error.message}`);
        if (attempt < maxRetries) {
          log.info(`Thử lại sau ${retryDelayMs / 1000} giây...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          attempt++;
        } else {
          log.warning(`Hết số lần thử, thử lại từ đầu sau ${retryDelayMs / 1000} giây...`);
          attempt = 1;
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      } else {
        log.error(`Lỗi không phải -32008: ${error.message}`);
        throw error;
      }
    }
  }
}

async function fetchTokenDecimals(tokenAddr, chainProvider) {
  try {
    const token = new ethers.Contract(tokenAddr, TOKEN_ABI, chainProvider);
    return await token.decimals();
  } catch (err) {
    log.error(`Không lấy được decimals cho token ${tokenAddr}: ${err.message}`);
    return 18;
  }
}

async function fetchTokenBalance(tokenAddr, walletAddr, chainProvider) {
  try {
    const token = new ethers.Contract(tokenAddr, TOKEN_ABI, chainProvider);
    return await token.balanceOf(walletAddr);
  } catch (err) {
    log.error(`Không lấy được số dư token ${tokenAddr}: ${err.message}`);
    return 0n;
  }
}

async function approveTokens(tokenAddr, spenderAddr, amount, wallet) {
  try {
    const token = new ethers.Contract(tokenAddr, TOKEN_ABI, wallet);
    const allowance = await token.allowance(wallet.address, spenderAddr);
    if (allowance >= amount) {
      log.success(`Đã phê duyệt đủ cho token ${tokenAddr}`);
      return true;
    }
    log.action(`Phê duyệt ${ethers.formatUnits(amount, await fetchTokenDecimals(tokenAddr, wallet.provider))} token ${tokenAddr}...`);
    const tx = await token.approve(spenderAddr, amount);
    await tx.wait();
    log.success(`Phê duyệt thành công`);
    return true;
  } catch (err) {
    log.error(`Phê duyệt thất bại cho token ${tokenAddr}: ${err.message}`);
    return false;
  }
}

async function executeSwapFromNative(wallet, tokenOutAddr, amountIn, swapContract, fee = DEFAULT_FEE) {
  const params = {
    tokenIn: WPHRS_TOKEN,
    tokenOut: tokenOutAddr,
    fee: fee,
    recipient: wallet.address,
    amountIn: amountIn,
    amountOutMinimum: MINIMUM_OUT,
    sqrtPriceLimitX96: 0,
  };
  const iface = new ethers.Interface(SWAP_ABI);
  const exactInputSingleData = iface.encodeFunctionData("exactInputSingle", [params]);
  const refundETHData = iface.encodeFunctionData("refundETH", []);
  const multicallData = [exactInputSingleData, refundETHData];

  return await retryTransaction(async () => {
    let gasLimit;
    try {
      gasLimit = await swapContract.multicall.estimateGas(multicallData, { value: amountIn });
      log.info(`Ước lượng gas: ${gasLimit.toString()}`);
      gasLimit = gasLimit * 200n / 100n;
    } catch (gasError) {
      log.warning(`Ước lượng gas thất bại: ${gasError.message}`);
      gasLimit = 3000000n;
    }
    const tx = await swapContract.multicall(multicallData, { value: amountIn, gasLimit });
    log.action(`Giao dịch đã gửi: ${tx.hash}`);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Giao dịch timeout sau 60 giây")), 60000)
      );
      const receipt = await Promise.race([tx.wait(), timeoutPromise]);
      log.success(`Hoàn tất swap PHRS -> ${tokenOutAddr === USDC_TOKEN ? 'USDC' : 'USDT'}. Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);
      return { success: true, transactionHash: tx.hash };
    } catch (error) {
      log.error(`Giao dịch thất bại: ${error.message}`);
      return { success: false };
    }
  });
}

async function executeSwapToNative(chainProvider, wallet, tokenAddr, percentage = 100) {
  try {
    const tokenContract = new ethers.Contract(tokenAddr, TOKEN_ABI, wallet);
    const swapContract = new ethers.Contract(SWAP_CONTRACT, SWAP_ABI, wallet);
    const tokenBalance = await tokenContract.balanceOf(wallet.address);
    const tokenDecimals = await fetchTokenDecimals(tokenAddr, chainProvider);
    log.info(`Số dư ${tokenAddr}: ${ethers.formatUnits(tokenBalance, tokenDecimals)}`);
    if (tokenBalance === 0n) {
      log.warning(`Không có số dư ${tokenAddr} để đổi về PHRS`);
      return { success: false };
    }
    const amountToSwap = tokenBalance * BigInt(percentage) / 100n;
    log.action(`Đang đổi ${ethers.formatUnits(amountToSwap, tokenDecimals)} ${tokenAddr} về PHRS (${percentage}% số dư)`);
    const approveSuccess = await approveTokens(tokenAddr, SWAP_CONTRACT, amountToSwap, wallet);
    if (!approveSuccess) {
      log.error(`Không phê duyệt được ${tokenAddr} để swap`);
      return { success: false };
    }
    let fee = DEFAULT_FEE;
    if (tokenAddr.toLowerCase() === USDT_TOKEN.toLowerCase()) {
      const poolContract = new ethers.Contract(USDT_POOL, POOL_ABI, chainProvider);
      try {
        fee = Number(await poolContract.fee());
        log.info(`Sử dụng phí pool USDT: ${fee}`);
      } catch (error) {
        log.warning(`Không lấy được phí pool USDT, dùng mặc định: ${fee}`);
      }
    } else if (tokenAddr.toLowerCase() === USDC_TOKEN.toLowerCase()) {
      const poolContract = new ethers.Contract(USDC_POOL, POOL_ABI, chainProvider);
      try {
        fee = Number(await poolContract.fee());
        log.info(`Sử dụng phí pool USDC: ${fee}`);
      } catch (error) {
        log.warning(`Không lấy được phí pool USDC, dùng mặc định: ${fee}`);
      }
    }
    const params = {
      tokenIn: tokenAddr,
      tokenOut: WPHRS_TOKEN,
      fee: fee,
      recipient: wallet.address,
      amountIn: amountToSwap,
      amountOutMinimum: MINIMUM_OUT,
      sqrtPriceLimitX96: 0,
    };
    const iface = new ethers.Interface(SWAP_ABI);
    const exactInputSingleData = iface.encodeFunctionData("exactInputSingle", [params]);
    const unwrapData = iface.encodeFunctionData("unwrapWETH9", [0, wallet.address]);
    const multicallData = [exactInputSingleData, unwrapData];

    return await retryTransaction(async () => {
      let gasLimit;
      try {
        gasLimit = await swapContract.multicall.estimateGas(multicallData);
        log.info(`Ước lượng gas: ${gasLimit.toString()}`);
        gasLimit = gasLimit * 200n / 100n;
      } catch (gasError) {
        log.warning(`Ước lượng gas thất bại: ${gasError.message}`);
        gasLimit = 3000000n;
      }
      const tx = await swapContract.multicall(multicallData, { gasLimit });
      log.action(`Giao dịch gửi cho ${tokenAddr} -> PHRS: ${tx.hash}`);

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Giao dịch timeout sau 60 giây")), 60000)
        );
        const receipt = await Promise.race([tx.wait(), timeoutPromise]);
        log.success(`Hoàn tất swap ${tokenAddr} -> PHRS. Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);
        return { success: true, transactionHash: tx.hash };
      } catch (error) {
        log.error(`Giao dịch thất bại: ${error.message}`);
        return { success: false };
      }
    });
  } catch (error) {
    log.error(`Lỗi khi swap ${tokenAddr} về PHRS: ${error.message}`);
    return { success: false };
  }
}

async function executeMultipleSwaps(chainProvider, wallet, jwt, proxy, swapCount) {
  log.banner(`Thực hiện ${swapCount} giao dịch swap`);
  let successCount = 0;
  let swapHistory = [];
  let phrsBalance = await chainProvider.getBalance(wallet.address);
  log.info(`Số dư PHRS ban đầu: ${ethers.formatEther(phrsBalance)} PHRS`);
  const swapContract = new ethers.Contract(SWAP_CONTRACT, SWAP_ABI, wallet);
  const AMOUNT_IN = ethers.parseEther((0.001).toFixed(3));

  for (let currentSwap = 0; currentSwap < swapCount; currentSwap++) {
    log.banner(`Swap lần ${currentSwap + 1}/${swapCount}`);
    const token = tokenInfo[currentSwap % 2];
    try {
      const tokenBalance = await fetchTokenBalance(token.address, wallet.address, chainProvider);
      const tokenDecimals = await fetchTokenDecimals(token.address, chainProvider);
      log.info(`Số dư ${token.name}: ${ethers.formatUnits(tokenBalance, tokenDecimals)}`);
      if (tokenBalance > 0n && (currentSwap % 4 === 1 || currentSwap % 4 === 3)) {
        log.action(`Đang đổi ${token.name} -> PHRS`);
        if (tokenBalance < ethers.parseUnits("0.0001", tokenDecimals)) {
          log.warning(`Không đủ ${token.name} để swap (cần ít nhất 0.0001)`);
          continue;
        }
        const result = await executeSwapToNative(chainProvider, wallet, token.address);
        if (result.success) {
          swapHistory.push({ type: `${token.name}->PHRS`, token: token.address });
          successCount++;
          log.success(`Hoàn tất swap ${currentSwap + 1}: ${token.name} -> PHRS`);
          if (jwt && result.transactionHash) {
            await verifyTask(wallet, proxy, jwt, result.transactionHash);
          }
        } else {
          log.error(`Không thể swap ${token.name} -> PHRS`);
        }
      } else if (phrsBalance >= AMOUNT_IN) {
        log.action(`Đang đổi PHRS -> ${token.name}`);
        if (phrsBalance < AMOUNT_IN) {
          log.warning(`Không đủ PHRS để swap (cần ít nhất ${ethers.formatEther(AMOUNT_IN)})`);
          continue;
        }
        const result = await executeSwapFromNative(wallet, token.address, AMOUNT_IN, swapContract);
        if (result.success) {
          swapHistory.push({ type: `PHRS->${token.name}`, token: token.address });
          successCount++;
          log.success(`Hoàn tất swap ${currentSwap + 1}: PHRS -> ${token.name}`);
          if (jwt && result.transactionHash) {
            await verifyTask(wallet, proxy, jwt, result.transactionHash);
          }
        } else {
          log.error(`Không thể swap PHRS -> ${token.name}`);
        }
      } else {
        log.warning(`Không đủ số dư PHRS (${ethers.formatEther(phrsBalance)}) để swap PHRS -> ${token.name}`);
        break;
      }
      phrsBalance = await chainProvider.getBalance(wallet.address);
      log.info(`Số dư PHRS hiện tại: ${ethers.formatEther(phrsBalance)} PHRS`);
      await new Promise(resolve => setTimeout(resolve, TX_PAUSE_MS));
    } catch (error) {
      log.error(`Lỗi ở swap ${currentSwap + 1}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, TX_PAUSE_MS));
    }
  }
  log.banner("Đổi tất cả token còn lại về PHRS");
  for (const token of tokenInfo) {
    const tokenBalance = await fetchTokenBalance(token.address, wallet.address, chainProvider);
    const tokenDecimals = await fetchTokenDecimals(token.address, chainProvider);
    log.info(`Số dư ${token.name}: ${ethers.formatUnits(tokenBalance, tokenDecimals)}`);
    if (tokenBalance > 0n) {
      log.action(`Đang đổi tất cả ${token.name} về PHRS`);
      if (tokenBalance < ethers.parseUnits("0.0001", tokenDecimals)) {
        log.warning(`Không đủ ${token.name} để swap (cần ít nhất 0.0001)`);
        continue;
      }
      const result = await executeSwapToNative(chainProvider, wallet, token.address);
      if (result.success) {
        log.success(`Đổi ${token.name} về PHRS thành công`);
        if (jwt && result.transactionHash) {
          await verifyTask(wallet, proxy, jwt, result.transactionHash);
        }
      } else {
        log.error(`Không thể đổi ${token.name} về PHRS`);
      }
      await new Promise(resolve => setTimeout(resolve, TX_PAUSE_MS));
    }
  }
  log.success(`Hoàn tất ${successCount}/${swapCount} giao dịch swap`);
  return successCount > 0;
}

async function provideLiquidity(chainProvider, wallet, tokenA, tokenB, poolAddr, amountA, amountB) {
  try {
    log.action(`Đang cung cấp thanh khoản cho ${tokenA}/${tokenB}`);
    const pool = new ethers.Contract(poolAddr, POOL_ABI, chainProvider);
    const actualTokenA = await pool.token0();
    const actualTokenB = await pool.token1();
    log.info(`Token0 từ pool: ${actualTokenA}`);
    log.info(`Token1 từ pool: ${actualTokenB}`);
    const actualFee = Number(await pool.fee());
    log.info(`Phí pool: ${actualFee} (${actualFee / 10000}%)`);

    let sortedAmountA, sortedAmountB;
    if (tokenA.toLowerCase() === actualTokenA.toLowerCase()) {
      sortedAmountA = amountA;
      sortedAmountB = amountB;
    } else {
      sortedAmountA = amountB;
      sortedAmountB = amountA;
    }

    const slot0 = await pool.slot0();
    const currentTick = Number(slot0.tick);
    const tickLower = -887270;
    const tickUpper = 887270;
    log.info(`Tick hiện tại: ${currentTick}, sử dụng khoảng FULL RANGE: ${tickLower} đến ${tickUpper}`);

    const approvedA = await approveTokens(actualTokenA, LP_CONTRACT, sortedAmountA, wallet);
    if (!approvedA) {
      log.error(`Không phê duyệt được ${actualTokenA}`);
      return { success: false };
    }

    const approvedB = await approveTokens(actualTokenB, LP_CONTRACT, sortedAmountB, wallet);
    if (!approvedB) {
      log.error(`Không phê duyệt được ${actualTokenB}`);
      return { success: false };
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const amountAMin = 0n;
    const amountBMin = 0n;

    const lpContract = new ethers.Contract(LP_CONTRACT, LP_ABI, wallet);
    const params = {
      token0: actualTokenA,
      token1: actualTokenB,
      fee: actualFee,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0Desired: sortedAmountA,
      amount1Desired: sortedAmountB,
      amount0Min: amountAMin,
      amount1Min: amountBMin,
      recipient: wallet.address,
      deadline: deadline,
    };

    return await retryTransaction(async () => {
      let gasLimit;
      try {
        gasLimit = await lpContract.mint.estimateGas(params);
        log.info(`Ước lượng gas: ${gasLimit.toString()}`);
        gasLimit = gasLimit * 200n / 100n;
      } catch (gasError) {
        log.warning(`Ước lượng gas thất bại: ${gasError.message}`);
        gasLimit = 5000000n;
      }

      const tx = await lpContract.mint(params, { gasLimit });
      log.action(`Giao dịch gửi để cung cấp thanh khoản: ${tx.hash}`);

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Giao dịch timeout sau 60 giây")), 60000)
        );
        const receipt = await Promise.race([tx.wait(), timeoutPromise]);

        let tokenId;
        try {
          for (const log of receipt.logs) {
            if (log.address.toLowerCase() === LP_CONTRACT.toLowerCase()) {
              if (log.topics[0].includes("0xb94bf7c5")) {
                tokenId = parseInt(log.topics[1], 16);
                break;
              }
            }
          }
        } catch (error) {
          log.warning(`Không lấy được token ID: ${error.message}`);
        }

        log.success(`Cung cấp thanh khoản thành công! ${tokenId ? `Token ID: ${tokenId}` : ""}`);
        log.info(`Gas sử dụng: ${receipt.gasUsed.toString()}`);
        return { success: true, transactionHash: tx.hash };
      } catch (error) {
        log.error(`Giao dịch thất bại: ${error.message}`);
        return { success: false };
      }
    });
  } catch (error) {
    log.error(`Lỗi khi cung cấp thanh khoản: ${error.message}`);
    return { success: false };
  }
}

async function provideMultipleLiquidity(chainProvider, wallet, jwt, proxy, lpCount) {
  log.banner(`Cung cấp thanh khoản cho ${WPHRS_TOKEN}/${USDC_TOKEN} (${lpCount} lần)`);
  try {
    const pool = new ethers.Contract(USDC_POOL, POOL_ABI, chainProvider);
    const actualTokenA = await pool.token0();
    const actualTokenB = await pool.token1();
    log.info(`Pool ${USDC_POOL}:`);
    log.info(`  Token0: ${actualTokenA}`);
    log.info(`  Token1: ${actualTokenB}`);

    const tokenADecimals = await fetchTokenDecimals(actualTokenA, chainProvider);
    const tokenBDecimals = await fetchTokenDecimals(actualTokenB, chainProvider);

    let successCount = 0;
    const swapContract = new ethers.Contract(SWAP_CONTRACT, SWAP_ABI, wallet);
    const MIN_USDC = ethers.parseUnits("0.1", tokenBDecimals);
    const SWAP_AMOUNT = ethers.parseEther("0.01");

    for (let i = 0; i < lpCount; i++) {
      log.banner(`Vòng cung cấp thanh khoản ${i + 1}/${lpCount}`);
      try {
        let tokenABalance = await fetchTokenBalance(actualTokenA, wallet.address, chainProvider);
        let tokenBBalance = await fetchTokenBalance(actualTokenB, wallet.address, chainProvider);
        log.info(`Số dư token để cung cấp thanh khoản:`);
        log.info(`  ${actualTokenA}: ${ethers.formatUnits(tokenABalance, tokenADecimals)}`);
        log.info(`  ${actualTokenB}: ${ethers.formatUnits(tokenBBalance, tokenBDecimals)}`);

        if (actualTokenB.toLowerCase() === USDC_TOKEN.toLowerCase() && tokenBBalance < MIN_USDC) {
          log.action(`Thiếu USDC, swap ${ethers.formatEther(SWAP_AMOUNT)} PHRS sang USDC`);
          const phrsBalance = await chainProvider.getBalance(wallet.address);
          if (phrsBalance < SWAP_AMOUNT) {
            log.warning(`Không đủ PHRS để swap thêm USDC`);
            continue;
          }
          const swapResult = await executeSwapFromNative(wallet, USDC_TOKEN, SWAP_AMOUNT, swapContract);
          if (!swapResult.success) {
            log.error(`Swap PHRS sang USDC thất bại`);
            continue;
          }
          tokenBBalance = await fetchTokenBalance(actualTokenB, wallet.address, chainProvider);
          log.info(`Số dư USDC sau swap: ${ethers.formatUnits(tokenBBalance, tokenBDecimals)}`);
        }

        if (tokenABalance === 0n || tokenBBalance === 0n) {
          log.warning("Không đủ token để cung cấp thanh khoản");
          continue;
        }

        let totalAmountAForLP = (tokenABalance * 80n) / 100n;
        let totalAmountBForLP = (tokenBBalance * 80n) / 100n;
        let amountAPerLP = totalAmountAForLP / BigInt(lpCount - i);
        let amountBPerLP = totalAmountBForLP / BigInt(lpCount - i);

        log.info(`Số lượng token cho vòng LP ${i + 1}:`);
        log.info(`  ${actualTokenA}: ${ethers.formatUnits(amountAPerLP, tokenADecimals)}`);
        log.info(`  ${actualTokenB}: ${ethers.formatUnits(amountBPerLP, tokenBDecimals)}`);

        const useAmountA = tokenABalance < amountAPerLP ? tokenABalance : amountAPerLP;
        const useAmountB = tokenBBalance < amountBPerLP ? tokenBBalance : amountBPerLP;

        if (useAmountA === 0n || useAmountB === 0n) {
          log.warning("Bỏ qua vòng LP này do không đủ token");
          continue;
        }

        const result = await provideLiquidity(
          chainProvider,
          wallet,
          actualTokenA,
          actualTokenB,
          USDC_POOL,
          useAmountA,
          useAmountB
        );

        if (result.success) {
          successCount++;
          log.success(`Vòng cung cấp thanh khoản ${i + 1} hoàn tất!`);
          if (jwt && result.transactionHash) {
            await verifyTask(wallet, proxy, jwt, result.transactionHash);
          }
        } else {
          log.error(`Không thể cung cấp thanh khoản ở vòng ${i + 1}`);
        }

        if (i < lpCount - 1) {
          log.info("Đợi 10 giây trước khi tiếp tục...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (error) {
        log.error(`Lỗi ở vòng cung cấp thanh khoản ${i + 1}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    log.success(`Hoàn tất ${successCount}/${lpCount} lần cung cấp thanh khoản`);
    return successCount > 0;
  } catch (error) {
    log.error(`Lỗi khi thực hiện nhiều lần cung cấp thanh khoản: ${error.message}`);
    return false;
  }
}

async function sendPHRS(chainProvider, wallet, index, proxy, friendAddresses, jwt) {
  try {
    const minAmount = 0.0001;
    const maxAmount = 0.0005;
    const amount = minAmount + Math.random() * (maxAmount - minAmount);
    const amountWei = ethers.parseEther(amount.toFixed(6).toString());
    const toAddress = friendAddresses[Math.floor(Math.random() * friendAddresses.length)];
    log.action(`Chuẩn bị gửi ${amount.toFixed(6)} PHRS tới ${toAddress}`);

    const balance = await chainProvider.getBalance(wallet.address);
    if (balance < amountWei) {
      log.warning(`Không đủ PHRS: ${ethers.formatEther(balance)} < ${amount.toFixed(6)}`);
      return;
    }

    return await retryTransaction(async () => {
      const feeData = await chainProvider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: amountWei,
        gasLimit: 21000,
        gasPrice,
        maxFeePerGas: feeData.maxFeePerGas || undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
      });

      log.action(`Giao dịch gửi: ${tx.hash}`);

      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Giao dịch timeout sau 60 giây")), 60000)
        );
        const receipt = await Promise.race([tx.wait(), timeoutPromise]);
        log.success(`Gửi PHRS thành công: ${tx.hash}`);
        log.info(`Explorer: https://testnet.pharosscan.xyz/tx/${tx.hash}`);
        if (jwt) {
          await verifyTask(wallet, proxy, jwt, tx.hash);
        }
        return { success: true };
      } catch (error) {
        log.error(`Giao dịch thất bại: ${error.message}`);
        return null;
      }
    });
  } catch (error) {
    log.error(`Gửi PHRS lần ${index + 1} thất bại: ${error.message}`);
  }
}

async function requestFaucet(chainWallet, proxy = null) {
  try {
    log.action(`Kiểm tra faucet cho ví ${chainWallet.address}`);
    const message = "pharos";
    const signature = await chainWallet.signMessage(message);

    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${chainWallet.address}&signature=${signature}&invite_code=Urcuq3cdNmvifZdS`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: "Bearer null",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": getRandomUserAgent(),
    };

    const loginResponse = await axios({
      method: 'post',
      url: loginUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const loginData = loginResponse.data;
    if (loginData.code !== 0 || !loginData.data.jwt) {
      log.error(`Faucet: Đăng nhập thất bại`);
      return false;
    }

    const jwt = loginData.data.jwt;
    const statusUrl = `https://api.pharosnetwork.xyz/faucet/status?address=${chainWallet.address}`;
    const statusHeaders = { ...headers, authorization: `Bearer ${jwt}` };

    const statusResponse = await axios({
      method: 'get',
      url: statusUrl,
      headers: statusHeaders,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const statusData = statusResponse.data;
    if (statusData.code !== 0 || !statusData.data) {
      log.error(`Faucet: Kiểm tra trạng thái thất bại`);
      return false;
    }

    if (!statusData.data.is_able_to_faucet) {
      log.warning(`Faucet: Đã nhận hôm nay`);
      return false;
    }

    const claimUrl = `https://api.pharosnetwork.xyz/faucet/daily?address=${chainWallet.address}`;
    const claimResponse = await axios({
      method: 'post',
      url: claimUrl,
      headers: statusHeaders,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const claimData = claimResponse.data;
    if (claimData.code === 0) {
      log.success(`Faucet: Nhận thành công`);
      return true;
    } else {
      log.error(`Faucet: Nhận thất bại`);
      return false;
    }
  } catch (error) {
    log.error(`Faucet: Lỗi - ${error.message}`);
    return false;
  }
}

async function performDailyCheckIn(chainWallet, proxy = null) {
  try {
    log.action(`Điểm danh ví ${chainWallet.address}`);
    const message = "pharos";
    const signature = await chainWallet.signMessage(message);

    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${chainWallet.address}&signature=${signature}&invite_code=Urcuq3cdNmvifZdS`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: "Bearer null",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": getRandomUserAgent(),
    };

    const loginResponse = await axios({
      method: 'post',
      url: loginUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const loginData = loginResponse.data;
    if (loginData.code !== 0 || !loginData.data.jwt) {
      log.error(`Check-in: Đăng nhập thất bại`);
      return null;
    }

    const jwt = loginData.data.jwt;
    const checkInUrl = `https://api.pharosnetwork.xyz/sign/in?address=${chainWallet.address}`;
    const checkInHeaders = { ...headers, authorization: `Bearer ${jwt}` };

    const checkInResponse = await axios({
      method: 'post',
      url: checkInUrl,
      headers: checkInHeaders,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const checkInData = checkInResponse.data;
    if (checkInData.code === 0) {
      log.success(`Check-in: Thành công`);
      return jwt;
    } else {
      log.warning(`Check-in: Đã điểm danh hôm nay`);
      return jwt;
    }
  } catch (error) {
    log.error(`Check-in: Lỗi - ${error.message}`);
    return null;
  }
}

async function fetchUserInfo(chainWallet, proxy = null, jwt) {
  try {
    log.action(`Lấy thông tin ví ${chainWallet.address}`);
    const profileUrl = `https://api.pharosnetwork.xyz/user/profile?address=${chainWallet.address}`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${jwt}`,
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": getRandomUserAgent(),
    };

    const response = await axios({
      method: 'get',
      url: profileUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const data = response.data;
    if (data.code !== 0 || !data.data.user_info) {
      log.error(`Lấy thông tin thất bại: ${data.msg || 'Lỗi không xác định'}`);
      return 0;
    }

    return data.data.user_info.TotalPoints;
  } catch (error) {
    log.error(`Lấy thông tin thất bại: ${error.message}`);
    return 0;
  }
}

async function verifyTask(chainWallet, proxy, jwt, txHash) {
  try {
    log.action(`Xác minh nhiệm vụ ${txHash}`);
    const verifyUrl = `https://api.pharosnetwork.xyz/task/verify?address=${chainWallet.address}&task_id=103&tx_hash=${txHash}`;
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${jwt}`,
      priority: "u=1, i",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": getRandomUserAgent(),
    };

    const response = await axios({
      method: 'post',
      url: verifyUrl,
      headers,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : null,
    });

    const data = response.data;
    if (data.code === 0 && data.data.verified) {
      log.success(`Xác minh nhiệm vụ thành công`);
      return true;
    } else {
      log.warning(`Xác minh nhiệm vụ thất bại`);
      return false;
    }
  } catch (error) {
    log.error(`Xác minh nhiệm vụ thất bại: ${error.message}`);
    return false;
  }
}

function loadProxies() {
  try {
    const proxies = fs.readFileSync('proxy.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    log.success(`Tải thành công ${proxies.length} proxy`);
    return proxies;
  } catch (error) {
    log.error(`Không tải được proxy: ${error.message}`);
    return [];
  }
}

function loadPrivateKeys() {
  try {
    const keys = fs.readFileSync('wallet.txt', 'utf8');
    const privateKeys = keys
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    log.success(`Tải thành công ${privateKeys.length} ví`);
    return privateKeys;
  } catch (error) {
    log.error(`Không tải được ví: ${error.message}`);
    return [];
  }
}

function loadFriendAddresses() {
  try {
    const addresses = fs.readFileSync('address.txt', 'utf8');
    const friendAddresses = addresses
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && ethers.isAddress(line));
    log.success(`Tải thành công ${friendAddresses.length} địa chỉ bạn bè`);
    return friendAddresses;
  } catch (error) {
    log.error(`Không tải được địa chỉ bạn bè: ${error.message}`);
    return [];
  }
}

function setupProvider(proxy = null) {
  if (proxy) {
    log.action(`Kết nối qua proxy: ${proxy}`);
    const agent = new HttpsProxyAgent(proxy);
    return new ethers.JsonRpcProvider(blockchainConfig.rpcEndpoint, {
      chainId: blockchainConfig.chainId,
      name: blockchainConfig.networkName,
    }, {
      fetchOptions: { agent },
      headers: { 'User-Agent': getRandomUserAgent() },
    });
  } else {
    log.action(`Kết nối trực tiếp`);
    return new ethers.JsonRpcProvider(blockchainConfig.rpcEndpoint, {
      chainId: blockchainConfig.chainId,
      name: blockchainConfig.networkName,
    });
  }
}

async function processWallet(privateKey, proxy, index, totalWallets, friendAddresses, mode, txCount) {
  const chainProvider = setupProvider(proxy);
  let chainWallet;
  try {
    chainWallet = new ethers.Wallet(privateKey, chainProvider);
  } catch (error) {
    log.error(`Ví #${index + 1} không hợp lệ: ${error.message}`);
    return;
  }

  log.banner(`--- Xử lý ví ${index + 1}/${totalWallets}: ${chainWallet.address} ---`);

  let jwt = await performDailyCheckIn(chainWallet, proxy);
  if (jwt) {
    const points = await fetchUserInfo(chainWallet, proxy, jwt);
    log.success(`Điểm: ${points}`);
  } else {
    log.error(`Không lấy được JWT, bỏ qua xác minh nhiệm vụ`);
  }

  if (mode === 'default' || mode === 'faucet-checkin') {
    await requestFaucet(chainWallet, proxy);
  }

  if (mode === 'default' || mode === 'swap') {
    await executeMultipleSwaps(chainProvider, chainWallet, jwt, proxy, txCount || SWAP_COUNT);
  }

  if (mode === 'default' || mode === 'lp') {
    await provideMultipleLiquidity(chainProvider, chainWallet, jwt, proxy, txCount || LP_COUNT);
  }

  if (mode === 'default' || mode === 'send') {
    if (friendAddresses.length === 0) {
      log.warning(`Không có địa chỉ bạn bè để gửi PHRS`);
    } else {
      for (let i = 0; i < (txCount || SEND_COUNT); i++) {
        await sendPHRS(chainProvider, chainWallet, i, proxy, friendAddresses, jwt);
        await new Promise(resolve => setTimeout(resolve, TX_PAUSE_MS));
      }
    }
  }

  log.success(`Hoàn tất ví ${chainWallet.address}`);
}

async function main() {
  log.banner('🌟 Pharos Testnet Auto Bot 🌟');

  console.log(colors.cyan('┌──────────────────────────────┐'));
  console.log(colors.cyan('│        CHỌN CHẾ ĐỘ           │'));
  console.log(colors.cyan('├──────────────────────────────┤'));
  console.log(colors.white('│ 1. Tất cả                    │'));
  console.log(colors.white('│ 2. Chỉ Faucet & Check-in     │'));
  console.log(colors.white('│ 3. Chỉ Swap                  │'));
  console.log(colors.white('│ 4. Chỉ Add LP                │'));
  console.log(colors.white('│ 5. Chỉ Send                  │'));
  console.log(colors.cyan('└──────────────────────────────┘'));
  console.log(colors.green('Nhấn Enter để chọn mặc định (1)'));

  const threadCount = parseInt(prompt(colors.yellow('Nhập số luồng (mặc định 1): ')) || '1', 10);

  let modeChoice;
  while (true) {
    modeChoice = prompt(colors.yellow('Nhập lựa chọn (1-5) [1]: ')) || '1';
    if (['1', '2', '3', '4', '5'].includes(modeChoice)) {
      break;
    }
    log.error('Lựa chọn không hợp lệ, vui lòng chọn từ 1 đến 5');
  }

  let mode = 'default';
  let txCount = null;
  switch (modeChoice) {
    case '2':
      mode = 'faucet-checkin';
      break;
    case '3':
      mode = 'swap';
      txCount = parseInt(prompt(colors.yellow('Nhập số giao dịch Swap: ')), 10);
      if (isNaN(txCount) || txCount <= 0) {
        log.error('Số giao dịch không hợp lệ, dùng mặc định 10');
        txCount = SWAP_COUNT;
      }
      break;
    case '4':
      mode = 'lp';
      txCount = parseInt(prompt(colors.yellow('Nhập số giao dịch Add LP: ')), 10);
      if (isNaN(txCount) || txCount <= 0) {
        log.error('Số giao dịch không hợp lệ, dùng mặc định 10');
        txCount = LP_COUNT;
      }
      break;
    case '5':
      mode = 'send';
      txCount = parseInt(prompt(colors.yellow('Nhập số giao dịch Send: ')), 10);
      if (isNaN(txCount) || txCount <= 0) {
        log.error('Số giao dịch không hợp lệ, dùng mặc định 10');
        txCount = SEND_COUNT;
      }
      break;
  }

  const proxies = loadProxies();
  const privateKeys = loadPrivateKeys();
  const friendAddresses = loadFriendAddresses();

  if (!privateKeys.length) {
    log.error('Không tìm thấy ví trong wallet.txt');
    return;
  }

  const walletList = privateKeys;
  const totalWallets = walletList.length;
  const threads = [];

  for (let i = 0; i < threadCount; i++) {
    const startIndex = i * Math.ceil(totalWallets / threadCount);
    const endIndex = Math.min((i + 1) * Math.ceil(totalWallets / threadCount), totalWallets);
    if (startIndex < totalWallets) {
      threads.push(
        (async () => {
          for (let j = startIndex; j < endIndex; j++) {
            const privateKey = walletList[j];
            const proxy = proxies[j % proxies.length] || null;
            await processWallet(privateKey, proxy, j, totalWallets, friendAddresses, mode, txCount);
            if (j < endIndex - 1) {
              log.info("Đợi 5 giây trước khi xử lý ví tiếp theo...");
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        })()
      );
    }
  }

  await Promise.all(threads);
  log.success('Hoàn tất xử lý tất cả ví!');
}

main().catch(error => {
  log.error(`Bot thất bại: ${error.message}`);
  log.info('Tiếp tục chạy bot...');
  main();
});