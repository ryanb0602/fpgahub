library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity neuron is
  Port ( 
    clk : in std_logic;
    reset_n : in std_logic;
    clear_score : in std_logic;
    
    --forward pass
    pixel_in : in std_logic;
    addr_r : in unsigned(9 downto 0);
    enable : in std_logic;

    weight_in : in std_logic;
    
    --neuron output
    activation_o  : out std_logic
    
  );
end neuron;

architecture Behavioral of neuron is

    signal current_score : signed(15 downto 0) := (others => '0');

begin

    process (clk)
    begin
        if rising_edge(clk) then
            if (reset_n) = '0' then
                current_score <= (others => '0');
            elsif clear_score = '1' then
                current_score <= (others => '0');
            elsif enable = '1' then
                if pixel_in = weight_in then
                        current_score <= current_score + 1;
                    else
                        current_score <= current_score - 1;
                    end if;
            end if;
        end if;
    end process;
    
    activation_o <= '1' when current_score >= 128 else '0';

end Behavioral;
