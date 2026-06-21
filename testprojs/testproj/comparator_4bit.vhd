library IEEE;
use IEEE.std_logic_1164.all;

--changed

entity comparator is
	port (
    	input_one : in STD_LOGIC_VECTOR(3 downto 0);
        input_two : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC_VECTOR(3 downto 0);
        eq : out STD_LOGIC);
end comparator;

architecture Behavioral of comparator is 

signal E_all, E3, E2, E1, one_gt_two: std_logic;

begin

	E3 <= '1' when (input_one(3) = input_two(3)) else '0';
    E2 <= '1' when (input_one(2) = input_two(2)) else '0';
    E1 <= '1' when (input_one(1) = input_two(1)) else '0';
    
    one_gt_two <= (input_one(3) and not input_two(3)) or
              (E3 and input_one(2) and not input_two(2)) or
              (E3 and E2 and input_one(1) and not input_two(1)) or
              (E3 and E2 and E1 and input_one(0) and not input_two(0));
              
    E_all <= (input_one(0) XNOR input_two(0)) AND (input_one(1) XNOR input_two(1)) AND (input_one(2) XNOR 					input_two(2)) AND (input_one(3) XNOR input_two(3));

	output <= input_one when one_gt_two = '1' else
    		  input_two when E_all = '0' else
              "0000";
              
    eq <= E_all;
    
end Behavioral;
