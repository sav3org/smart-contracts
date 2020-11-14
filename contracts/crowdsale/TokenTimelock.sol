pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// a progressively unlocking timelock

/**
 * @dev A token holder contract that will allow a beneficiary to extract the
 * tokens after a given release time.
 *
 * Useful for simple vesting schedules like "advisors get all of their tokens
 * after 1 year".
 *
 * For a more complete vesting schedule, see {TokenVesting}.
 */
contract TokenTimelock {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ERC20 basic token contract being held
    IERC20 private _token;

    // beneficiary of tokens after they are released
    address private _beneficiary;

    // timestamp when token release is enabled
    uint256 private _releaseTime;

    // timestamp when tokens were locked
    uint256 public startTime = block.timestamp;

    // how many tokens have been released so far
    uint256 public totalReleased;

    // how many tokens to lock initially
    uint256 public startLockedBalance;

    constructor (IERC20 token, address beneficiary, uint256 releaseTime, uint256 _startLockedBalance) public {
        // solhint-disable-next-line not-rely-on-time
        require(releaseTime > block.timestamp, "TokenTimelock: release time is before current time");
        _token = token;
        _beneficiary = beneficiary;
        _releaseTime = releaseTime;
        startLockedBalance = _startLockedBalance;
    }

    /**
     * @return the token being held.
     */
    function token() public view returns (IERC20) {
        return _token;
    }

    /**
     * @return the beneficiary of the tokens.
     */
    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    /**
     * @return the time when 100% of the tokens can be released.
     */
    function releaseTime() public view returns (uint256) {
        return _releaseTime;
    }

    // how much can be released right now
    function releasable() public view returns (uint256) {
        uint256 totalLockTime = _releaseTime.sub(startTime);
        uint256 timeElapsed = block.timestamp.sub(startTime);
        uint256 percentTimeElapsed = timeElapsed.mul(100).div(totalLockTime);
        uint256 startLockedBalanceReleasable = startLockedBalance.mul(percentTimeElapsed).div(100);
        uint256 balanceReleasable = startLockedBalanceReleasable.sub(totalReleased);
        uint256 balance = _token.balanceOf(address(this));
        // will occur after release time has passed
        if (balanceReleasable > balance) {
            return balance;
        }
        return balanceReleasable;
    }

    /**
     * @notice Transfers tokens held by timelock to beneficiary.
     */
    function release() public {
        uint256 balanceReleasable = releasable();
        require(balanceReleasable > 0, "TokenTimelock: no tokens to release");
        totalReleased = totalReleased + balanceReleasable;
        _token.safeTransfer(_beneficiary, balanceReleasable);
    }
}
