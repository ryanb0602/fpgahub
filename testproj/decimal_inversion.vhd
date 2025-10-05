library IEEE;
use IEEE.std_logic_1164.all;

entity decimal_inversion is
	port (
    	input : in STD_LOGIC_VECTOR(3 downto 0);
        output : out STD_LOGIC_VECTOR(3 downto 0)
    );
end decimal_inversion;

architecture Structural of decimal_inversion is

component four_bit_full_adder is
    Port (
        -- Define top-level ports as needed, for example:
        input_one : in  STD_LOGIC_VECTOR(3 downto 0);
        input_two : in  STD_LOGIC_VECTOR(3 downto 0);
        output : out  STD_LOGIC_VECTOR(3 downto 0);
        carry_out : out STD_LOGIC
    );
end component;

signal bitwise_inverted : STD_LOGIC_VECTOR(3 downto 0);

begin

	bitwise_inverted(0) <= NOT(input(0));
    bitwise_inverted(1) <= NOT(input(1));
    bitwise_inverted(2) <= NOT(input(2));
    bitwise_inverted(3) <= NOT(input(3));

	U1: four_bit_full_adder port map (
    	input_one => bitwise_inverted,
        input_two => "0001",
        output => output
        --carry_out => carry_out
    );

end Structural;