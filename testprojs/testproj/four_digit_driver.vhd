library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.STD_LOGIC_ARITH.ALL;
use IEEE.STD_LOGIC_UNSIGNED.ALL;

entity four_digit_driver is
    Port ( digit_one : std_logic_vector(3 downto 0);
           digit_two : std_logic_vector(3 downto 0);
           digit_three : std_logic_vector(3 downto 0);
           digit_four : std_logic_vector(3 downto 0);
           clock_100Mhz : in std_logic;
           Anode_Activate : out STD_LOGIC_VECTOR (3 downto 0);
           LED_out : out STD_LOGIC_VECTOR (6 downto 0)
           );
end four_digit_driver;

architecture Behavioral of four_digit_driver is

component display_driver is
    Port ( input : in  STD_LOGIC_VECTOR (3 downto 0);
           seg_out : out  STD_LOGIC_VECTOR (6 downto 0));
end component;

signal refresh_counter: STD_LOGIC_VECTOR (19 downto 0):= (others => '0');


signal LED_activating_counter: std_logic_vector(1 downto 0);

signal input_value : std_logic_vector(3 downto 0);

begin

    U1 : display_driver port map (
        input => input_value,
        seg_out => LED_out  
    );

    process(clock_100Mhz)
    begin 
        if(rising_edge(clock_100Mhz)) then
            refresh_counter <= refresh_counter + 1;
        end if;
    end process;
     LED_activating_counter <= refresh_counter(19 downto 18);
    -- 4-to-1 MUX to generate anode activating signals for 4 LEDs 
    process(LED_activating_counter)
    begin
        case LED_activating_counter is
        when "00" =>
            Anode_Activate <= "0111"; 
            -- activate LED1 and Deactivate LED2, LED3, LED4
            input_value <= digit_one;
            -- the first hex digit of the 16-bit number
        when "01" =>
            Anode_Activate <= "1011"; 
            -- activate LED2 and Deactivate LED1, LED3, LED4
            input_value <= digit_two;
            -- the second hex digit of the 16-bit number
        when "10" =>
            Anode_Activate <= "1101"; 
            -- activate LED3 and Deactivate LED2, LED1, LED4
            input_value <= digit_three;
            -- the third hex digit of the 16-bit number
        when "11" =>
            Anode_Activate <= "1110"; 
            -- activate LED4 and Deactivate LED2, LED3, LED1
            input_value <= digit_four;
            -- the fourth hex digit of the 16-bit number    
        end case;
    end process;

end Behavioral;