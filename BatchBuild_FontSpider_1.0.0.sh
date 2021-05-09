#!/d/html
echo "please input build path:"
read path
echo "start build"
function getdir(){
    for element in `ls $1`
    do  
        dir_or_file=$1"/"$element
        if [ -d $dir_or_file ]
        then 
            getdir $dir_or_file
        else
	   dir_type=${element##*.}
	   if [ "html" = $dir_type ]
		then  
		output=$output" dest""$1"/"$element"
		buildput=$buildput" ""$1"/"$element"
		echo "build finish : "$1"/"$element
           fi  
        fi  
    done
}
root_dir=$path
#root_dir="/d/html"
output=""
buildput=""
getdir $root_dir
#font-spider$output
#echo "final output :"$output
#echo "final buildput :"$buildput
#font-spider$output
font-spider$buildput
echo "build complete"