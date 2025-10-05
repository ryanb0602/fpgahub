library IEEE;
use IEEE.std_logic_1164.all;

entity subtract is
	port (
    	input_one : in STD_LOGIC_VECTOR(3 downto 0);
        input_two : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC_VECTOR(3 downto 0));
end subtract;

architecture Structural of subtract is 

signal inverted_input_two : STD_LOGIC_VECTOR(3 downto 0);

component four_bit_full_adder is
    Port (
        -- Define top-level ports as needed, for example:
        input_one : in  STD_LOGIC_VECTOR(3 downto 0);
        input_two : in  STD_LOGIC_VECTOR(3 downto 0);
        output : out  STD_LOGIC_VECTOR(3 downto 0);
        carry_out : out STD_LOGIC
    );
end component;

component decimal_inversion is
	port (
    	input : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC_VECTOR(3 downto 0)
        );
end component;

begin

	U1: decimal_inversion port map (
    	input => input_two,
        output => inverted_input_two
    );
    
    U2: four_bit_full_adder port map(
    	input_one => input_one,
        input_two => inverted_input_two,
        output => output
        --carry_out => carry_out
    );
    
end Structural;