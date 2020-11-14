pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20TransferLiquidityLock is ERC20 {
    using SafeMath for uint256;

    event LockLiquidity(uint256 tokenAmount, uint256 ethAmount);
    event BurnLiquidity(uint256 lpTokenAmount);
    event RewardLiquidityProviders(uint256 tokenAmount);

    address public uniswapV2Router;
    address public uniswapV2Pair;

    // the amount of tokens to lock for liquidity during every transfer, i.e. 100 = 1%, 50 = 2%, 40 = 2.5%
    uint256 public liquidityLockDivisor;
    uint256 public liquidityRewardsDivisor;

    function _transfer(address from, address to, uint256 amount) internal {
        // calculate liquidity lock amount
        // dont transfer burn from this contract
        // or can never lock full lockable amount
        if (liquidityLockDivisor != 0 && from != address(this)) {
            uint256 liquidityLockAmount = amount.div(liquidityLockDivisor);
            super._transfer(from, address(this), liquidityLockAmount);
            super._transfer(from, to, amount.sub(liquidityLockAmount));
        }
        else {
            super._transfer(from, to, amount);
        }
    }

    // receive eth from uniswap swap
    function () external payable {}

    function lockLiquidity(uint256 _lockableSupply) public {
        // lockable supply is the token balance of this contract
        require(_lockableSupply <= balanceOf(address(this)), "ERC20TransferLiquidityLock::lockLiquidity: lock amount higher than lockable balance");
        require(_lockableSupply != 0, "ERC20TransferLiquidityLock::lockLiquidity: lock amount cannot be 0");

        // reward liquidity providers if needed
        if (liquidityRewardsDivisor != 0) {
            // if no balance left to lock, don't lock
            if (liquidityRewardsDivisor == 1) {
                _rewardLiquidityProviders(_lockableSupply);
                return;
            }

            uint256 liquidityRewards = _lockableSupply.div(liquidityRewardsDivisor);
            _lockableSupply = _lockableSupply.sub(liquidityRewards);
            _rewardLiquidityProviders(liquidityRewards);
        }

        uint256 amountToSwapForEth = _lockableSupply.div(2);
        uint256 amountToAddLiquidity = _lockableSupply.sub(amountToSwapForEth);

        // needed in case contract already owns eth
        uint256 ethBalanceBeforeSwap = address(this).balance;
        swapTokensForEth(amountToSwapForEth);
        uint256 ethReceived = address(this).balance.sub(ethBalanceBeforeSwap);

        addLiquidity(amountToAddLiquidity, ethReceived);
        emit LockLiquidity(amountToAddLiquidity, ethReceived);
    }

    // external util so anyone can easily distribute rewards
    // must call lockLiquidity first which automatically
    // calls _rewardLiquidityProviders
    function rewardLiquidityProviders() external {
        // lock everything that is lockable
        lockLiquidity(balanceOf(address(this)));
    }

    function _rewardLiquidityProviders(uint256 liquidityRewards) private {
        // avoid burn by calling super._transfer directly
        super._transfer(address(this), uniswapV2Pair, liquidityRewards);
        IUniswapV2Pair(uniswapV2Pair).sync();
        emit RewardLiquidityProviders(liquidityRewards);
    }

    function burnLiquidity() external {
        uint256 balance = ERC20(uniswapV2Pair).balanceOf(address(this));
        require(balance != 0, "ERC20TransferLiquidityLock::burnLiquidity: burn amount cannot be 0");
        ERC20(uniswapV2Pair).transfer(address(0), balance);
        emit BurnLiquidity(balance);
    }

    function swapTokensForEth(uint256 tokenAmount) private {
        address[] memory uniswapPairPath = new address[](2);
        uniswapPairPath[0] = address(this);
        uniswapPairPath[1] = IUniswapV2Router02(uniswapV2Router).WETH();

        _approve(address(this), uniswapV2Router, tokenAmount);

        IUniswapV2Router02(uniswapV2Router)
            .swapExactTokensForETHSupportingFeeOnTransferTokens(
                tokenAmount,
                0,
                uniswapPairPath,
                address(this),
                block.timestamp
            );
    }

    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        _approve(address(this), uniswapV2Router, tokenAmount);

        IUniswapV2Router02(uniswapV2Router)
            .addLiquidityETH
            .value(ethAmount)(
                address(this),
                tokenAmount,
                0,
                0,
                address(this),
                block.timestamp
            );
    }

    // returns token amount
    function lockableSupply() external view returns (uint256) {
        return balanceOf(address(this));
    }

    // returns token amount
    function lockedSupply() external view returns (uint256) {
        uint256 lpTotalSupply = ERC20(uniswapV2Pair).totalSupply();
        uint256 lpBalance = lockedLiquidity();
        uint256 percentOfLpTotalSupply = lpBalance.mul(1e12).div(lpTotalSupply);

        uint256 uniswapBalance = balanceOf(uniswapV2Pair);
        uint256 _lockedSupply = uniswapBalance.mul(percentOfLpTotalSupply).div(1e12);
        return _lockedSupply;
    }

    // returns token amount
    function burnedSupply() external view returns (uint256) {
        uint256 lpTotalSupply = ERC20(uniswapV2Pair).totalSupply();
        uint256 lpBalance = burnedLiquidity();
        uint256 percentOfLpTotalSupply = lpBalance.mul(1e12).div(lpTotalSupply);

        uint256 uniswapBalance = balanceOf(uniswapV2Pair);
        uint256 _burnedSupply = uniswapBalance.mul(percentOfLpTotalSupply).div(1e12);
        return _burnedSupply;
    }

    // returns LP amount, not token amount
    function burnableLiquidity() public view returns (uint256) {
        return ERC20(uniswapV2Pair).balanceOf(address(this));
    }

    // returns LP amount, not token amount
    function burnedLiquidity() public view returns (uint256) {
        return ERC20(uniswapV2Pair).balanceOf(address(0));
    }

    // returns LP amount, not token amount
    function lockedLiquidity() public view returns (uint256) {
        return burnableLiquidity().add(burnedLiquidity());
    }
}

interface IUniswapV2Router02 {
    function WETH() external pure returns (address);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
}

interface IUniswapV2Pair {
    function sync() external;
}
