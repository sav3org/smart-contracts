pragma solidity ^0.5.17;

import "@openzeppelin/contracts/access/roles/WhitelistAdminRole.sol";

// costs 0.5ETH at 100 GWEI to whitelist 250 addresses using mapping of bools
// the whitelister can be deployed any time on a seperate contract
// when GWEI is low

// if GWEI is 20, it is possible to whitelist 3000 addresses for 1.2ETH

// another method is using merkle proofs like uniswap https://github.com/Uniswap/merkle-distributor

contract Whitelister is WhitelistAdminRole {
    mapping(address => bool) public whitelisted;

    function whitelist(address[] memory addresses) public onlyWhitelistAdmin {
        for (uint i = 0; i < addresses.length; i++) {
            whitelisted[addresses[i]] = true;
        }
    }

    function unwhitelist(address[] memory addresses) public onlyWhitelistAdmin {
        for (uint i = 0; i < addresses.length; i++) {
            whitelisted[addresses[i]] = false;
        }
    }
}
