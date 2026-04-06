library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

-- Uncomment the following library declaration if instantiating
-- any Xilinx leaf cells in this code.
--library UNISIM;
--use UNISIM.VComponents.all;

entity BNN_Controller is
  Port ( 
    clk : in std_logic;
    reset_n : in std_logic;
    image_ready : in std_logic;
    is_training : in std_logic; -- high if mode is train
    
    pixel_addr : out unsigned(9 downto 0);
    calc_enable_hidden : out std_logic;
    calc_enable_output : out std_logic;
    clear_hidden : out std_logic;
    clear_output : out std_logic;
    
    hidden_layer_output_addr : out unsigned(8 downto 0);
    
    argmax_start : out std_logic;
    argmax_done : in std_logic;
    argmax_output : in std_logic_vector(3 downto 0);
    
    backprop_start : out std_logic;
    backprop_done : in std_logic;
    
    bnn_done : out std_logic
  );
end BNN_Controller;

architecture Behavioral of BNN_Controller is

type state_type is (IDLE, INIT_HIDDEN, RUN_HIDDEN, INIT_OUTPUT, WAIT_OUTPUT, RUN_OUTPUT, RUN_ARGMAX, WAIT_ARGMAX, DONE, RUN_BACKPROP, WAIT_BACKPROP);
signal state : state_type := IDLE;

signal counter : unsigned(9 downto 0) := (others => '0');

signal argmax_result : std_logic_vector(3 downto 0);

attribute MAX_FANOUT : integer;
signal clear_hidden_int : std_logic := '0';
attribute MAX_FANOUT of clear_hidden_int : signal is 32;


begin

    clear_hidden <= clear_hidden_int;

    process(clk)
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                state <= IDLE;
            else
                case state is 
                    when IDLE =>
                    
                        calc_enable_hidden  <= '0';
                        calc_enable_output  <= '0';
                        clear_hidden_int <= '0';
                        clear_output <= '0';
                        bnn_done     <= '0';
                        argmax_start <= '0';
                                        
                        if image_ready = '1' then
                            state <= INIT_HIDDEN;
                        end if;
                        
                    when INIT_HIDDEN =>
                        clear_hidden_int <= '1';
                        counter <= (others => '0');
                        state <= RUN_HIDDEN;
                        
                    when RUN_HIDDEN =>
                        calc_enable_hidden <= '1';
                        clear_hidden_int <= '0';
                        
                        -- Safety check: Only update address if within valid BRAM range
                        if counter <= 783 then
                            pixel_addr <= counter(9 downto 0);
                        end if;
                        
                        if counter = 784 then 
                            calc_enable_hidden <= '0';
                            state       <= INIT_OUTPUT;
                            counter     <= (others => '0');
                        else
                            counter <= counter + 1;
                        end if;
                        
                    when INIT_OUTPUT =>
                        clear_output <= '1';
                        counter <= (others => '0');
                        hidden_layer_output_addr <= (others => '0');
                        state <= WAIT_OUTPUT;
                        
                    when WAIT_OUTPUT =>
                        clear_output <= '0';
                        state <= RUN_OUTPUT;
                        
                    when RUN_OUTPUT =>
                        
                        if counter < 255 then
                             hidden_layer_output_addr <= counter(8 downto 0) + 1;
                        end if;
                        
                        if counter <= 255 then
                            calc_enable_output <= '1';
                        else
                            calc_enable_output <= '0';
                        end if;
                            
                        if counter = 256 then
                            calc_enable_output <= '0';
                            state <= RUN_ARGMAX;
                            counter <= (others => '0');
                        else
                            counter <= counter + 1;
                        end if;
                            
                    when RUN_ARGMAX =>
                        argmax_start <= '1';
                        state <= WAIT_ARGMAX;
                        
                    when WAIT_ARGMAX =>
                        if argmax_done = '1' then
                            argmax_start <= '0';
                            argmax_result <= argmax_output;
                            if is_training = '1' then
                                state <= RUN_BACKPROP;
                            else
                                state <= DONE;
                            end if;
                        end if;
                        
                    when RUN_BACKPROP =>
                        backprop_start <= '1';
                        state <= WAIT_BACKPROP;
                        
                    when WAIT_BACKPROP =>
                        if backprop_done = '1' then
                            backprop_start <= '0';
                            state <= DONE;
                        end if;
                        
                    when DONE => 
                            bnn_done <= '1';
                            if image_ready = '0' then
                                bnn_done <= '0';
                                state <= IDLE;
                            end if;
                    end case;
            end if;
        end if;
    end process;
end Behavioral;
