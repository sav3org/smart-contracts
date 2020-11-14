pragma solidity ^0.5.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/access/roles/WhitelistAdminRole.sol";
import "./ERC20/ERC20TransferLiquidityLock.sol";
import "./ERC20/ERC20Governance.sol";

contract Sav3Token is 
    ERC20, 
    ERC20Detailed("Sav3Token", "SAV3", 18), 
    ERC20Burnable, 
    ERC20Mintable,
    // governance must be before transfer liquidity lock
    // or delegates are not updated correctly
    ERC20Governance,
    ERC20TransferLiquidityLock,
    WhitelistAdminRole 
{
    function setUniswapV2Router(address _uniswapV2Router) public onlyWhitelistAdmin {
        require(uniswapV2Router == address(0), "Sav3Token::setUniswapV2Router: already set");
        uniswapV2Router = _uniswapV2Router;
    }

    function setUniswapV2Pair(address _uniswapV2Pair) public onlyWhitelistAdmin {
        require(uniswapV2Pair == address(0), "Sav3Token::setUniswapV2Pair: already set");
        uniswapV2Pair = _uniswapV2Pair;
    }

    function setLiquidityLockDivisor(uint256 _liquidityLockDivisor) public onlyWhitelistAdmin {
        if (_liquidityLockDivisor != 0) {
            require(_liquidityLockDivisor >= 10, "Sav3Token::setLiquidityLockDivisor: too small");
        }
        liquidityLockDivisor = _liquidityLockDivisor;
    }

    function setLiquidityRewardsDivisor(uint256 _liquidityRewardsDivisor) public onlyWhitelistAdmin {
        liquidityRewardsDivisor = _liquidityRewardsDivisor;
    }
}
