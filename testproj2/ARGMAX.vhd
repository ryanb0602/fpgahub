library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

use IEEE.NUMERIC_STD.ALL;

entity ARGMAX is
    Port (
        clk : in std_logic;
        reset_n : in std_logic;
        start : in std_logic;
        
        -- Training inputs
        true_value : in std_logic_vector(7 downto 0); 
        
        score_in : in std_logic_vector(15 downto 0);
        score_addr : out unsigned(3 downto 0);
        
        predict : out std_logic_vector(3 downto 0);
        score_gap : out std_logic_vector(15 downto 0); -- Output to Backprop
        
        done : out std_logic
    );
end ARGMAX;

architecture Behavioral of ARGMAX is

type state_type is (IDLE, REQUEST, COMPARING, DATA_WAIT, FINISHED);
signal state : state_type := IDLE;
signal current_max : signed(15 downto 0);
signal target_score : signed(15 downto 0); -- New register
signal best_idx : unsigned(3 downto 0);
signal i : unsigned(3 downto 0);

begin

    process(clk)
        variable v_true_idx : unsigned(3 downto 0);
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                state <= IDLE;
                done <= '0';
                score_addr <= (others => '0');
            else
                v_true_idx := unsigned(true_value(3 downto 0)); -- Cast once for comparison
                
                case state is
                    when IDLE =>
                        done <= '0';
                        if start = '1' then
                            i <= (others => '0');
                            current_max <= to_signed(-32768, 16); -- Smallest possible
                            target_score <= (others => '0');
                            state <= REQUEST;
                        end if;

                    when REQUEST =>
                        score_addr <= i;
                        state <= DATA_WAIT;

                    when DATA_WAIT =>
                        state <= COMPARING;

                    when COMPARING =>
                        -- 1. Update the Target Score if this index matches the truth
                        if i = v_true_idx then
                            target_score <= signed(score_in);
                        end if;

                        -- 2. Update the Global Max (Standard Argmax)
                        if i = 0 then
                            current_max <= signed(score_in);
                            best_idx <= (others => '0');
                        else
                            if signed(score_in) >= current_max then
                                current_max <= signed(score_in);
                                best_idx <= i;
                            end if;
                        end if;
                        
                        -- 3. Loop Control
                        if i = 9 then
                            state <= FINISHED;
                        else
                            i <= i + 1;
                            state <= REQUEST;
                        end if;

                    when FINISHED => 
                        predict <= std_logic_vector(best_idx);
                        -- Calculate Gap: (Winner Score - Correct Target Score)
                        -- If correct, Gap = 0. If wrong, Gap is positive.
                        score_gap <= std_logic_vector(current_max - target_score);
                        
                        done <= '1';
                        if start = '0' then
                            state <= IDLE;
                        end if;
                end case;
            end if;
        end if;
    end process;
    
end Behavioral;